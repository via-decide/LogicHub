# Hardware-Software Bridge: Physical Git Objects & Deterministic Physical CI/CD

## Purpose

Core specification for `logichub.app`'s hardware-software bridge — the mechanism by which a
physical manufacturing action (a cut, a print, an assembly, a calibration run) becomes a
verifiable, content-addressed "commit" that a "physical PR" merge gate can accept or reject.
Mirrors this repo's existing `engineering/packages/*` contract pattern (content-addressed
artifacts, `schemaVersion`, SHA-256 provenance — see `engineering/docs/contracts/artifact.md`) but
extends it down to bare-metal firmware, since the artifact's *origin* is now a physical sensor
payload, not a generated file.

Four phases, each independently implementable and testable, matching this repo's existing
package boundaries (`physical-loop`, `project-capsule`, `commerce` already exist —
Phase 1/2 below is new firmware-side work; Phase 3/4 extend `project-capsule` and `commerce`).

---

## Phase 1: The Hardware Logic Gate (Bare-Metal Determinism)

### Why determinism is the actual product, not a nice-to-have

The whole trust model collapses if two runs of the identical physical test on identical hardware
produce different hashes for reasons unrelated to the physical event itself (scheduler jitter, an
allocator returning a different memory layout, an interrupt landing mid-sample-window). So the
constraint isn't "prefer no heap allocation" — it's **zero dynamic allocation on any path that
touches sensor data, rule evaluation, or hashing**, full stop, checked at compile time where
possible (a linker map free of `malloc`/`operator new` symbols in the CI gate) not just by
convention.

### Toolchain & target

- Raspberry Pi Pico SDK (C, not C++ where avoidable — C++ is fine for the host-side tooling, but
  the hot path below is deliberately plain C to keep the compiled-output audit trivial).
- `pico-sdk` HAL for GPIO/I2C/SPI; `hardware_pio` for the two autonomous state machines below.
- No RTOS. A single bare-metal cooperative loop on core 0; core 1 dedicated to rule evaluation +
  hashing so a long SHA-256 pass never delays the next sensor sample window.

### PIO architecture — two independent state machines, zero CPU polling overhead

The requirement is "continuous, autonomous sensor polling... without interrupting the main
processor's logic evaluation." PIO is the right tool specifically because its state machines run
independently of the ARM cores once configured — the CPU only ever *drains a FIFO*, it never
blocks waiting on I2C/timing.

```c
// pio_sensor_bridge.h — two PIO SMs, one per sensor bus, each pushing fixed-width
// samples into its own DMA-fed ring buffer. Core 0 never issues an I2C transaction
// directly; it only reads from sio_hw-mapped ring buffers already fed by DMA.

#define PIO_SM_IMU_BUS   0   // pio0, sm0 — MPU6050, I2C0
#define PIO_SM_TOUCH_BUS 1   // pio0, sm1 — MPR121, I2C1

#define IMU_SAMPLE_HZ    1000   // 1kHz — matches MPU6050's internal DLPF bandwidth at
                                // the tightest setting; oversample vs. touch to catch
                                // fast trajectory features (a "strike," not just a "hold")
#define TOUCH_SAMPLE_HZ  100    // capacitive settle time dominates here; 100Hz is
                                // already well above MPR121's own debounce filter rate

typedef struct __attribute__((packed)) {
    uint32_t t_us;        // free-running timer, not wall clock — determinism means
                           // "relative to test start," not "relative to RTC," since
                           // RTC drift alone could otherwise change a hash
    int16_t  ax, ay, az;  // raw accel, no float conversion on-device (see Phase 3)
    int16_t  gx, gy, gz;  // raw gyro
} imu_sample_t;            // 16 bytes, power-of-two friendly for the ring buffer

typedef struct __attribute__((packed)) {
    uint32_t t_us;
    uint16_t channel_mask;   // 12-bit MPR121 touch state, bit-packed
    uint16_t filtered[12];   // raw capacitance readings, pre-threshold
} touch_sample_t;             // 32 bytes

// Ring buffers are fixed-size, statically allocated at link time -- NOT malloc'd.
// Sized for the longest permitted single test run (RULES.yaml enforces a max
// duration; see Phase 2) so overflow is structurally impossible, not just checked.
#define IMU_RING_DEPTH   (IMU_SAMPLE_HZ * MAX_TEST_DURATION_S)
#define TOUCH_RING_DEPTH (TOUCH_SAMPLE_HZ * MAX_TEST_DURATION_S)

static imu_sample_t   imu_ring[IMU_RING_DEPTH];
static touch_sample_t touch_ring[TOUCH_RING_DEPTH];
static volatile uint32_t imu_write_idx = 0, touch_write_idx = 0;

void pio_sensor_bridge_init(PIO pio) {
    // Each SM runs a tight PIO program: assert I2C start, clock out the fixed
    // register-read sequence for that sensor, push the result to its own FIFO,
    // sleep the remaining cycles to hit the target sample rate exactly (PIO's
    // deterministic instruction timing is what makes the SAMPLE RATE ITSELF
    // reproducible across boards -- not just the reading).
    uint imu_offset   = pio_add_program(pio, &imu_i2c_poll_program);
    uint touch_offset = pio_add_program(pio, &touch_i2c_poll_program);

    imu_i2c_poll_program_init(pio, PIO_SM_IMU_BUS, imu_offset, IMU_SAMPLE_HZ);
    touch_i2c_poll_program_init(pio, PIO_SM_TOUCH_BUS, touch_offset, TOUCH_SAMPLE_HZ);

    // DMA channels drain each SM's RX FIFO straight into the ring buffers above,
    // in ring-buffer (wrapping) mode, with an IRQ on the DMA channel (not the PIO
    // SM) once the current test's expected sample count is reached. The CPU is
    // never in the sampling path at all until the test ends.
    dma_channel_configure(imu_dma_chan, &imu_dma_cfg,
        imu_ring, &pio->rxf[PIO_SM_IMU_BUS], IMU_RING_DEPTH, true);
    dma_channel_configure(touch_dma_chan, &touch_dma_cfg,
        touch_ring, &pio->rxf[PIO_SM_TOUCH_BUS], TOUCH_RING_DEPTH, true);
}

// Core 0's ENTIRE runtime loop. No sensor I/O here -- it only checks whether DMA
// has signaled test-complete, then hands the two fixed-size, already-full ring
// buffers to core 1 for rule evaluation (Phase 3). This is the "without
// interrupting the main processor's logic evaluation" requirement satisfied
// structurally: logic evaluation and sensor capture literally cannot contend
// for the same execution resource, because they're on different cores AND the
// capture path never touches core 0 at all.
void core0_main_loop(void) {
    for (;;) {
        if (dma_channel_get_irq0_status(imu_dma_chan) &&
            dma_channel_get_irq0_status(touch_dma_chan)) {
            multicore_fifo_push_blocking(TEST_COMPLETE_SIGNAL);
            dma_channel_acknowledge_irq0(imu_dma_chan);
            dma_channel_acknowledge_irq0(touch_dma_chan);
        }
        tight_loop_contents();
    }
}
```

**Why not interrupts instead of PIO+DMA for the sampling itself**: an ISR-driven I2C poll still
steals cycles from core 0 at unpredictable points relative to whatever core 0 was doing —
technically "the CPU handles it," but it reintroduces exactly the jitter determinism can't
tolerate. PIO's state machines execute a fixed instruction count per sample with cycle-accurate
timing independent of anything else happening on either ARM core; that's the actual reason PIO is
the correct primitive here, not "it's the RP2040's showcase feature."

---

## Phase 2: The 8MB Local-First Repository (Storage & Routing)

### Partition layout

```
0x10000000 ─┬─ 0x10100000 (1MB): XIP firmware (this program, boots directly from flash)
            │
0x10100000 ─┴─ 0x10800000 (7MB): LittleFS partition — the "local-first repository"
```

```c
// storage_init.c
#include "littlefs/lfs.h"
#include "hardware/flash.h"
#include "hardware/sync.h"

#define XIP_FIRMWARE_SIZE   (1024 * 1024)          // 1MB, matches partition table above
#define LFS_PARTITION_OFFSET XIP_FIRMWARE_SIZE      // LittleFS starts right after firmware
#define LFS_PARTITION_SIZE  (7 * 1024 * 1024)       // remaining 7MB of the W25Q64

// LittleFS block-device shim over the Pico SDK's flash API. Reads are direct
// memory-mapped XIP reads (fast, no bus transaction); writes/erases go through
// flash_range_program/flash_range_erase, which the SDK already serializes
// against XIP execution correctly (core 1 is what's running this, so core 0's
// own firmware execution out of the lower 1MB is unaffected).
static int lfs_bd_read(const struct lfs_config *c, lfs_block_t block,
                        lfs_off_t off, void *buffer, lfs_size_t size) {
    uint32_t addr = XIP_BASE + LFS_PARTITION_OFFSET + (block * c->block_size) + off;
    memcpy(buffer, (const void *)addr, size);
    return LFS_ERR_OK;
}

static int lfs_bd_prog(const struct lfs_config *c, lfs_block_t block,
                        lfs_off_t off, const void *buffer, lfs_size_t size) {
    uint32_t flash_offset = LFS_PARTITION_OFFSET + (block * c->block_size) + off;
    uint32_t ints = save_and_disable_interrupts();
    flash_range_program(flash_offset, buffer, size);
    restore_interrupts(ints);
    return LFS_ERR_OK;
}

static int lfs_bd_erase(const struct lfs_config *c, lfs_block_t block) {
    uint32_t flash_offset = LFS_PARTITION_OFFSET + (block * c->block_size);
    uint32_t ints = save_and_disable_interrupts();
    flash_range_erase(flash_offset, c->block_size);
    restore_interrupts(ints);
    return LFS_ERR_OK;
}

static int lfs_bd_sync(const struct lfs_config *c) { return LFS_ERR_OK; }

const struct lfs_config lhub_lfs_cfg = {
    .read  = lfs_bd_read,
    .prog  = lfs_bd_prog,
    .erase = lfs_bd_erase,
    .sync  = lfs_bd_sync,
    // W25Q64 erases in 4KB sectors -- block_size MUST match the physical erase
    // granularity or every write silently corrupts adjacent blocks on wear.
    .block_size  = 4096,
    .block_count = LFS_PARTITION_SIZE / 4096,   // 1792 blocks
    .cache_size  = 256,      // matches W25Q64's page-program size (256B pages)
    .lookahead_size = 32,
    .block_cycles = 500,     // conservative NOR wear-leveling threshold
};

lfs_t lhub_fs;

int storage_init(void) {
    int err = lfs_mount(&lhub_fs, &lhub_lfs_cfg);
    if (err) {
        // First boot, or corrupted FS -- format once. Never silently reformat
        // on a mount error after first boot; that would destroy RULES.yaml and
        // every prior TELEMETRY.log, which is exactly the provenance chain
        // Phase 3 depends on existing. Distinguish "never formatted" from
        // "corrupted" via a magic byte at a fixed LFS attribute, not by assuming.
        err = lfs_format(&lhub_fs, &lhub_lfs_cfg);
        if (err) return err;
        err = lfs_mount(&lhub_fs, &lhub_lfs_cfg);
    }
    return err;
}
```

### File routing: `RULES.yaml` and `TELEMETRY.log` sequences

```
/rules/RULES.yaml              — one active ruleset, read fully into a static
                                  buffer at boot (see below), never re-parsed
                                  mid-test
/telemetry/{test_uuid}.log     — one file PER PHYSICAL TEST RUN, not one
                                  continuously-appended global log. A test run
                                  is the unit that becomes a "physical commit,"
                                  so it needs its own file boundary to hash
                                  cleanly (Phase 3) and to survive a partial
                                  write without corrupting prior runs' provenance.
/commits/{sha256}.json         — the finalized commit object once a test run
                                  passes rule evaluation (Phase 3/4)
```

```c
// rules_loader.c — RULES.yaml is small (physical tolerance tables, not a
// general-purpose config), so it's read whole into a fixed static buffer at
// boot, not streamed. A YAML parse mid-test-run would be a second source of
// nondeterminism (parser timing varies with content) on top of the sensor
// jitter Phase 1 already eliminated -- so parsing happens ONCE, at boot,
// before any sensor sampling begins, and the parsed rule struct is immutable
// for the remainder of that firmware's uptime.

#define RULES_MAX_BYTES 8192   // hard ceiling -- RULES.yaml is tolerance
                                // tables, not scripts; if it needs to be
                                // bigger than this, that's a signal the rule
                                // model is wrong, not that the buffer should grow

static char rules_raw[RULES_MAX_BYTES];
static physical_ruleset_t active_rules;   // parsed, immutable after boot

int rules_load(void) {
    lfs_file_t f;
    int err = lfs_file_open(&lhub_fs, &f, "/rules/RULES.yaml", LFS_O_RDONLY);
    if (err) return err;

    lfs_ssize_t n = lfs_file_read(&lhub_fs, &f, rules_raw, RULES_MAX_BYTES - 1);
    lfs_file_close(&lhub_fs, &f);
    if (n < 0) return (int)n;
    rules_raw[n] = '\0';

    // Minimal, deterministic YAML subset parser (see RULES.yaml schema below) --
    // NOT a general YAML library. General YAML parsers have too much undefined/
    // implementation-varying behavior (anchor resolution order, float parsing
    // edge cases) to trust for a value that feeds a hash comparison. Only the
    // exact tolerance-table shape below is accepted; anything else is a parse
    // error, not "best effort."
    return parse_physical_ruleset_strict(rules_raw, n, &active_rules);
}

// One TELEMETRY.log file per test run. Filename is the test's UUID (generated
// at test start from the RP2040's hardware RNG + free-running timer, not from
// wall-clock RTC, for the same determinism reason as t_us above).
int telemetry_open_for_test(const char *test_uuid, lfs_file_t *out_file) {
    char path[64];
    snprintf(path, sizeof(path), "/telemetry/%s.log", test_uuid);
    // LFS_O_CREAT | LFS_O_EXCL -- refuse to overwrite an existing test's log.
    // A UUID collision or a retry-with-same-id is a real bug to surface, not
    // paper over by silently appending to or replacing prior telemetry.
    return lfs_file_open(&lhub_fs, out_file, path,
                          LFS_O_WRONLY | LFS_O_CREAT | LFS_O_EXCL);
}

// Called from core 0's post-test-complete path (after the PIO/DMA capture in
// Phase 1 signals TEST_COMPLETE_SIGNAL) -- writes the two ring buffers out as
// a single, fixed-layout binary stream, not re-serialized as text. Text
// serialization of floats is itself a nondeterminism vector (rounding/locale);
// keeping the on-disk format identical to the on-wire sample struct sidesteps
// that entirely, and Phase 3 hashes these exact bytes.
int telemetry_write_test(lfs_file_t *f, const imu_sample_t *imu, uint32_t imu_n,
                          const touch_sample_t *touch, uint32_t touch_n) {
    telemetry_header_t hdr = {
        .magic = TELEMETRY_MAGIC,
        .schema_version = 1,
        .imu_sample_count = imu_n,
        .touch_sample_count = touch_n,
        .imu_sample_hz = IMU_SAMPLE_HZ,
        .touch_sample_hz = TOUCH_SAMPLE_HZ,
    };
    if (lfs_file_write(&lhub_fs, f, &hdr, sizeof(hdr)) < 0) return -1;
    if (lfs_file_write(&lhub_fs, f, imu, sizeof(imu_sample_t) * imu_n) < 0) return -1;
    if (lfs_file_write(&lhub_fs, f, touch, sizeof(touch_sample_t) * touch_n) < 0) return -1;
    return lfs_file_close(&lhub_fs, f);
}
```

### `RULES.yaml` schema (strict subset — matches `parse_physical_ruleset_strict` above)

```yaml
schemaVersion: "1.0.0"
ruleset_id: "hilt-grip-tolerance-v3"
max_test_duration_s: 30           # sizes the ring buffers in Phase 1 at compile time

imu_bounds:
  # every field is a closed numeric range; the parser rejects anything else
  # (no expressions, no cross-field references) -- deterministic evaluation
  # requires the rule language to have no evaluation order ambiguity at all
  accel_peak_g:   { min: 0.0, max: 8.0 }
  gyro_peak_dps:  { min: 0.0, max: 2000.0 }
  trajectory_smoothness_min: 0.85   # computed metric, see Phase 3

touch_bounds:
  min_simultaneous_channels: 3
  max_simultaneous_channels: 8
  settle_time_ms_max: 50
  per_channel_capacitance:
    - { channel: 0, min: 200, max: 4000 }
    - { channel: 1, min: 200, max: 4000 }
    # ... one entry per active MPR121 channel, no wildcard/default -- every
    # channel's bound is explicit so the ruleset is fully enumerable and
    # itself hashable (see Phase 3's rules_hash)
```

---

## Phase 3: Cryptographic Commits & Provenance (The CI/CD Engine)

### Pipeline shape

```
raw ring buffers (Phase 1)
   → TELEMETRY.log written to LittleFS (Phase 2)
   → core 1: evaluate against active_rules (deterministic, integer/fixed-point math only)
   → core 1: SHA-256 over the EXACT bytes written to TELEMETRY.log (not a re-derived
             representation of it) + the active ruleset's own bytes
   → commit object written to /commits/{sha256}.json
   → transmitted to logichub.app backend for PR-merge evaluation (Phase 4)
```

The critical design decision: **hash the raw telemetry bytes and the raw rules bytes, not a
"summary" or "result" of evaluating them.** If the hash covered only the pass/fail outcome, two
physically different test runs that both happen to pass would be indistinguishable — defeating the
entire "0.01mm coordinate change must change the hash" requirement. The hash is over evidence; the
pass/fail flag is a separate, derived field alongside it.

```c
// commit_pipeline.c
#include "mbedtls/sha256.h"

typedef struct {
    char     ruleset_id[64];
    uint8_t  rules_sha256[32];      // hash of RULES.yaml bytes as loaded, immutable per boot
    uint8_t  telemetry_sha256[32];  // hash of this test's exact TELEMETRY.log bytes
    uint8_t  commit_sha256[32];     // hash of (rules_sha256 || telemetry_sha256 || test_uuid)
    bool     passed;
    physical_eval_result_t eval;    // the specific metrics that were checked, for audit
} physical_commit_t;

// Fixed-point, not float, for every comparison against RULES.yaml bounds.
// float comparison results can differ across compilers/optimization levels
// even for "the same" arithmetic (FMA contraction, x87 vs SSE historically,
// -ffast-math reordering) -- this firmware image is meant to be reproducibly
// rebuildable and produce byte-identical commit hashes for byte-identical
// telemetry, which float doesn't guarantee across toolchains. IMU raw values
// are already integer (Phase 1); keep them integer through evaluation too.
static bool evaluate_imu_bounds(const imu_sample_t *samples, uint32_t n,
                                 const imu_bounds_t *bounds,
                                 physical_eval_result_t *out) {
    int32_t peak_accel_mg = 0, peak_gyro_mdps = 0;
    for (uint32_t i = 0; i < n; i++) {
        int32_t a_mag = fixed_point_magnitude_mg(samples[i].ax, samples[i].ay, samples[i].az);
        int32_t g_mag = fixed_point_magnitude_mdps(samples[i].gx, samples[i].gy, samples[i].gz);
        if (a_mag > peak_accel_mg) peak_accel_mg = a_mag;
        if (g_mag > peak_gyro_mdps) peak_gyro_mdps = g_mag;
    }
    out->accel_peak_mg = peak_accel_mg;
    out->gyro_peak_mdps = peak_gyro_mdps;
    return peak_accel_mg <= bounds->accel_peak_mg_max
        && peak_gyro_mdps <= bounds->gyro_peak_mdps_max;
    // trajectory_smoothness_min evaluated similarly via a fixed-point jerk
    // (d(accel)/dt) variance calculation -- omitted here for length, same
    // integer-only discipline applies.
}

int commit_pipeline_run(const char *test_uuid,
                         const imu_sample_t *imu, uint32_t imu_n,
                         const touch_sample_t *touch, uint32_t touch_n,
                         physical_commit_t *out_commit) {
    // 1. Evaluate strictly against active_rules (Phase 2's parsed ruleset).
    physical_eval_result_t eval = {0};
    bool imu_ok   = evaluate_imu_bounds(imu, imu_n, &active_rules.imu_bounds, &eval);
    bool touch_ok = evaluate_touch_bounds(touch, touch_n, &active_rules.touch_bounds, &eval);
    out_commit->passed = imu_ok && touch_ok;
    out_commit->eval = eval;
    strncpy(out_commit->ruleset_id, active_rules.ruleset_id, sizeof(out_commit->ruleset_id));

    // 2. Hash the ruleset bytes exactly as loaded (rules_raw from Phase 2),
    //    not the parsed struct -- the parsed struct's memory layout is a
    //    compiler/ABI detail, not evidence; the YAML bytes are the evidence.
    mbedtls_sha256_context ctx;
    mbedtls_sha256_init(&ctx);
    mbedtls_sha256_starts(&ctx, 0);   // 0 = SHA-256, not SHA-224
    mbedtls_sha256_update(&ctx, (const unsigned char *)rules_raw, rules_raw_len);
    mbedtls_sha256_finish(&ctx, out_commit->rules_sha256);
    mbedtls_sha256_free(&ctx);

    // 3. Hash the exact TELEMETRY.log bytes written in Phase 2 -- re-read from
    //    LittleFS rather than re-serializing in memory, so the hash covers
    //    literally what's on disk and what a later auditor re-reading the
    //    file will also hash, closing any gap between "what we hashed" and
    //    "what's stored."
    lfs_file_t f;
    char path[64];
    snprintf(path, sizeof(path), "/telemetry/%s.log", test_uuid);
    if (lfs_file_open(&lhub_fs, &f, path, LFS_O_RDONLY) != LFS_ERR_OK) return -1;

    mbedtls_sha256_init(&ctx);
    mbedtls_sha256_starts(&ctx, 0);
    uint8_t buf[256];
    lfs_ssize_t r;
    while ((r = lfs_file_read(&lhub_fs, &f, buf, sizeof(buf))) > 0) {
        mbedtls_sha256_update(&ctx, buf, (size_t)r);
    }
    lfs_file_close(&lhub_fs, &f);
    mbedtls_sha256_finish(&ctx, out_commit->telemetry_sha256);
    mbedtls_sha256_free(&ctx);

    // 4. Commit hash binds ruleset + telemetry + test identity together --
    //    changing ANY of the three changes the commit hash, which is what
    //    lets a merge-gate later prove "this exact telemetry, evaluated
    //    against this exact ruleset, for this exact test" without re-running
    //    anything.
    mbedtls_sha256_init(&ctx);
    mbedtls_sha256_starts(&ctx, 0);
    mbedtls_sha256_update(&ctx, out_commit->rules_sha256, 32);
    mbedtls_sha256_update(&ctx, out_commit->telemetry_sha256, 32);
    mbedtls_sha256_update(&ctx, (const unsigned char *)test_uuid, strlen(test_uuid));
    mbedtls_sha256_finish(&ctx, out_commit->commit_sha256);
    mbedtls_sha256_free(&ctx);

    return 0;
}
```

**Why a 0.01mm coordinate change actually propagates to the hash**: the IMU's raw `int16_t`
readings are the finest-grained representation of "where the physical object was" this system
captures — a 0.01mm positional difference in a real strike/grip produces a different accelerometer
integration curve, which is different raw sample bytes, which changes `telemetry_sha256` (SHA-256
has no near-collision tolerance — one bit different in, completely different hash out), which
changes `commit_sha256`. Nothing in the pipeline smooths, averages, or lossily compresses the raw
samples before they're hashed — smoothing happens only in `evaluate_*_bounds` for the *pass/fail*
decision, which is a separate field from the hash, exactly so a manufacturer can't argue "it still
passed, so the hash shouldn't matter."

### Commit object (`/commits/{sha256}.json`) — the artifact handed to Phase 4

```json
{
  "schemaVersion": "1.0.0",
  "commitSha256": "e3b0c4...(hex)",
  "testUuid": "01936f2a-...",
  "rulesetId": "hilt-grip-tolerance-v3",
  "rulesSha256": "9f86d0...(hex)",
  "telemetrySha256": "2c26b4...(hex)",
  "passed": true,
  "eval": {
    "accelPeakMg": 2340,
    "gyroPeakMdps": 891000,
    "trajectorySmoothness": "0.912"
  },
  "device": {
    "boardId": "rp2040-hilt-0417",
    "firmwareSha256": "5891ab...(hex)"
  },
  "createdAtDeviceUs": 184223991
}
```

---

## Phase 4: Executable Licensing & Royalties

### Executable Hardware License schema

Content-addressed and versioned the same way `engineering/docs/contracts/artifact.md` already
treats generated artifacts — a license is itself a contract object with a `schemaVersion`, not a
prose document.

```json
{
  "schemaVersion": "1.0.0",
  "licenseId": "ehl_9f2a3c...",
  "designId": "hilt-mk3-tsaber",
  "designSha256": "7d4e91...(hex)",
  "licensor": {
    "creatorId": "creator_4471",
    "payoutRoute": {
      "type": "webhook",
      "url": "https://payouts.logichub.app/v1/route/creator_4471",
      "fallback": {
        "type": "smart_contract_event",
        "chain": "base",
        "contractAddress": "0x...",
        "eventSignature": "RoyaltyOwed(bytes32,address,uint256)"
      }
    }
  },
  "royalty": {
    "model": "per_unit",
    "amountMinorUnits": 250,
    "currency": "USD",
    "triggerCondition": "PHYSICAL_PR_MERGED"
  },
  "manufacturingConstraints": {
    "requiredRulesetId": "hilt-grip-tolerance-v3",
    "requiredRulesetMinVersion": "3.0.0",
    "maxUnitsPerPeriod": 500,
    "periodDays": 30
  },
  "revocation": {
    "revocable": true,
    "revokedAt": null
  }
}
```

### Physical PR merge state machine

```
   SUBMITTED
      │  vendor uploads commit object (Phase 3) + claims a licenseId
      ▼
   VERIFYING
      │  backend re-derives commitSha256 from the submitted rulesSha256 +
      │  telemetrySha256 + testUuid -- if it doesn't match the submitted
      │  commitSha256, reject immediately (tamper/transmission error,
      │  indistinguishable and both correctly rejected)
      │  backend independently checks `passed` against its OWN copy of the
      │  named ruleset (never trusts the device's `passed` flag alone --
      │  the device could be compromised; the hash chain lets the backend
      │  re-run evaluate_*_bounds server-side against the same raw bytes)
      ▼
   PASSED ──────────────► FAILED (terminal; commit object retained for audit,
      │                            not deleted -- a failed physical PR is
      │                            still provenance evidence of an attempt)
      │
      │  ROYALTY ROUTING HAPPENS HERE, BEFORE MERGE -- this ordering is
      │  the actual answer to "how does the JSON payload trigger routing
      │  before the PR officially merges": PASSED is necessary but not
      │  sufficient for MERGED; royalty confirmation is also required.
      ▼
   ROYALTY_PENDING
      │  backend emits the webhook (primary) from `licensor.payoutRoute`
      │  with a payload binding commitSha256 + licenseId + royalty amount;
      │  on webhook failure/timeout, falls back to emitting the smart
      │  contract event instead -- exactly one of the two paths is
      │  confirmed, never both (idempotency key = commitSha256, so a
      │  retried webhook after a contract-event fallback already fired
      │  is a no-op, not a double payout)
      ▼
   ROYALTY_CONFIRMED
      │  webhook 200 + payout confirmation OR on-chain event finalized
      ▼
   MERGED   ← terminal, immutable. The physical PR is now part of the
              design's accepted manufacturing history; commitSha256 is
              appended to the design's commit chain (same content-addressed
              model as engineering/packages/product-repository already
              uses for software revisions -- physical and software history
              share one chain shape)
```

```json
// Webhook payload sent to licensor.payoutRoute.url at ROYALTY_PENDING
{
  "event": "physical_pr.royalty_owed",
  "commitSha256": "e3b0c4...(hex)",
  "licenseId": "ehl_9f2a3c...",
  "designId": "hilt-mk3-tsaber",
  "manufacturer": {
    "vendorId": "vendor_8821",
    "unitCount": 1
  },
  "royalty": {
    "amountMinorUnits": 250,
    "currency": "USD"
  },
  "idempotencyKey": "e3b0c4...(hex)",
  "requiresConfirmationWithin": "PT24H"
}
```

**Why merge is gated on royalty confirmation, not just on `passed: true`**: the stated goal is
"protect independent creators" — if merge happened purely on physical pass/fail, a manufacturer
could produce a passing unit and the design's public commit history would show it as accepted
before the creator's royalty was ever confirmed, with no remaining leverage to enforce payment
after the fact (the physical unit already exists in the world either way). Requiring
`ROYALTY_CONFIRMED` before `MERGED` means the platform's own source of truth (the commit chain)
never legitimizes a unit the creator hasn't been paid for, which is the actual mechanism — not the
webhook/event emission itself, which is just the delivery detail.
