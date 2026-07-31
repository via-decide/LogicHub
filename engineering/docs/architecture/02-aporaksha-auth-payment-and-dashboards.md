# Aporaksha NFC Settlement Layer & Three-Tier Dashboard Architecture

## Purpose

Extends `01-hardware-bridge-spec.md`'s physical-PR commit pipeline with the final authorization/
settlement layer (Aporaksha NFC 2FA gating fund release) and specifies the three user-facing
dashboards that surface the whole pipeline (creator, vendor, buyer).

**Grounding note, checked against the real codebase before writing this** — Aporaksha isn't a
clean-slate design. `via/aporaksha` already has: a real JWT auth system (`api/auth.js`, HMAC-SHA256,
pbkdf2 password hashing), a real Razorpay payment integration (`api/payments/create-order.js`,
writing to a `passports` SQL table), a "Passport" identity model with an `nfc_chip_id` field
(`passport/passport-model.js`), and a currently-selling product — **SmartTag Lite**, at
`viadecide.com/printbydd-store/smarttag-lite` (single + bulk-5-pack, per
`lib/passportEngine.js`'s real product catalogue). This spec is written as an upgrade path from
that real system, not a replacement — Part A calls out exactly what's reused vs. what's new.

**Critical existing gap found and confirmed** — `passport/nfc/nfc-passport-reader.js`'s current
implementation uses the browser Web NFC API (`NDEFReader`) to read a raw NFC serial and look it up
via `ZayvoraPassportAuth.getNfcProfile(serial)`. **There is no cryptographic challenge-response at
all today** — it's a bare serial-number lookup, and the code even ships a fallback simulator with a
hardcoded example serial when Web NFC isn't available. Any NTAG215's UID (or the simulator input
box) satisfies this today. Phase 1 below is specifically the fix for this — upgrading to NTAG424
DNA's SUN feature, which is a real, unforgeable-without-the-key mechanism, unlike a bare UID read.

---

# Part A: Aporaksha Auth & Payment Settlement

## Phase 1: The Aporaksha NFC Handshake

### Why NTAG424 DNA specifically, not NTAG215

NTAG215 (what the current simulator implies) has a static, readable UID and no secure messaging —
anyone who's ever tapped the tag (or intercepted the UID once) can replay it forever. NTAG424 DNA
supports **SUN (Secure Unique NFC)**: on every tap, the chip itself computes a fresh CMAC over the
UID + a monotonic read counter, using a key provisioned once at manufacture and never exposed over
NFC. The URL/payload the phone reads changes every single tap — replaying an old tap's captured
payload fails, because the counter has moved on. This is the actual mechanism that makes the tag a
"physical cryptographic key" rather than a physical bearer token.

### Provisioning at purchase (SmartTag Lite → Aporaksha Auth keychain)

```
Manufacturing time (before shipping):
  1. NTAG424 DNA chip programmed with a per-unit AES-128 key (K_tag), generated
     by an HSM-backed provisioning service — never derived from anything
     printable/guessable (not "tag #4471's key = f(4471)").
  2. K_tag is written ONLY to: (a) the chip's protected key slot (SDMMetaReadKey,
     never readable back over NFC by design), and (b) logichub.app's provisioning
     database, encrypted at rest, keyed by the chip's factory-fixed 7-byte UID.
  3. Chip is potted into the 3D-printed keychain shell. From this point on, K_tag
     physically cannot leave the chip except via the SUN mechanism's CMAC output
     (which proves possession of K_tag without revealing it).

Purchase time (existing Razorpay flow in api/payments/create-order.js, reused
as-is for the "smarttag_lite_single"/"smarttag_lite_bulk" SKUs already in
lib/passportEngine.js's PRODUCTS catalogue):
  4. Buyer completes Razorpay checkout — no change to this path.
  5. On payment confirmation, backend generates a one-time claim token bound to
     the ORDER, not yet to any specific physical chip UID (the warehouse hasn't
     picked a unit yet) — see Phase 4 for the actual UID-binding step, which
     happens at first-tap onboarding, not at purchase time.
```

### Challenge-response on every authorization tap (SUN verification)

```
Vendor taps Aporaksha keychain to phone/desktop NFC reader to authorize a merge:

  1. NTAG424 DNA, on tap, auto-generates and appends to its NDEF URL record:
       https://auth.logichub.app/v/{UID}?e={enc_data}&c={cmac}
     where enc_data = AES-CBC(K_tag, UID || read_counter) and
           cmac     = AES-CMAC(K_tag, UID || read_counter)
     This happens ENTIRELY ON-CHIP -- the reading device (phone/desktop) never
     sees K_tag, only the resulting URL. This is standard NTAG424 SUN behavior,
     not custom firmware on the tag side.

  2. Reading device (vendor's phone via Web NFC, or desktop USB NFC reader) just
     forwards this URL to logichub.app's backend as-is -- it does zero
     cryptographic work itself, which matters: the reading device is untrusted
     (could be a compromised laptop), so verification MUST happen server-side
     against the provisioning-time K_tag, never client-side.

  3. Backend: look up K_tag by UID (from the provisioning DB, Phase 1 step 2).
     Decrypt enc_data, recompute cmac independently, compare against the
     received cmac (constant-time compare). Reject if mismatch.

  4. Reject if read_counter <= last_seen_counter for this UID (monotonic replay
     guard -- this is what makes an intercepted URL from a PAST tap useless,
     not just theoretically re-encrypted differently).

  5. On success: this tap authenticates "the physical Aporaksha device with
     this UID was present, right now, for the first time this counter value
     has ever been seen." It does NOT yet authenticate "for THIS specific
     physical PR" -- that binding happens in Phase 2's payload.
```

```json
// POST /api/aporaksha/verify-tap — backend request/response shape
{
  "request": {
    "sunUid": "04A1B2C3D4E5F6",
    "encData": "8f3a...(hex)",
    "cmac": "2c19...(hex)",
    "physicalPrId": "pr_9f2a3c..."
  },
  "response": {
    "verified": true,
    "vendorId": "vendor_8821",
    "readCounter": 4127,
    "tapTimestamp": "2026-07-31T04:12:09Z",
    "boundToPhysicalPrId": "pr_9f2a3c..."
  }
}
```

---

## Phase 2: The Physical PR Merge Gate — State Bridging Hardware Result to Payment Intent

### State machine (extends `01-hardware-bridge-spec.md` Phase 4's chain by inserting the auth gate before ROYALTY_PENDING)

```
SUBMITTED → VERIFYING → PASSED → PENDING_AUTH → ROYALTY_PENDING → ROYALTY_CONFIRMED → MERGED
                     ↘ FAILED (terminal)              ↘ AUTH_EXPIRED (terminal, PR stays PASSED
                                                          but requires a fresh tap to retry --
                                                          the hardware result doesn't expire,
                                                          only the authorization window does)
```

`PENDING_AUTH` is entered automatically the instant hardware evaluation returns `passed: true`
(Phase 3 of the hardware spec) — the platform doesn't wait for the vendor to request payment, it
immediately puts the ball in "needs a physical tap" state, with a bounded window
(`authExpiresAt`, e.g. 24h) after which it reverts to requiring a fresh tap rather than trusting a
stale authorization intent indefinitely.

```typescript
// PhysicalPR — extends this repo's existing content-addressed contract pattern
// (see engineering/packages/contracts/src/decision/decision.schema.ts for the
// zod convention this mirrors)
import { z } from 'zod';

export const PhysicalPRStatusSchema = z.enum([
  'SUBMITTED', 'VERIFYING', 'FAILED', 'PASSED',
  'PENDING_AUTH', 'AUTH_EXPIRED',
  'ROYALTY_PENDING', 'ROYALTY_CONFIRMED', 'MERGED',
]);

export const PhysicalPRSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.string().default('1.0.0'),
  repositoryId: z.string().min(1),        // links to the design repo (Phase 1's designId)
  vendorId: z.string().min(1),
  commitSha256: z.string().length(64),    // from 01-hardware-bridge-spec.md Phase 3
  status: PhysicalPRStatusSchema,

  // Populated only once PASSED -- never before, since it would otherwise be
  // possible to pre-authorize a merge for a test that hasn't run yet.
  authExpiresAt: z.string().datetime().nullable(),
  aporakshaAuth: z.object({
    sunUid: z.string(),
    readCounter: z.number().int(),
    verifiedAt: z.string().datetime(),
  }).nullable(),

  royalty: z.object({
    licenseId: z.string(),
    amountMinorUnits: z.number().int(),
    currency: z.string(),
    settlementRef: z.string().nullable(),   // Razorpay payout id / on-chain tx hash
  }).nullable(),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PhysicalPR = z.infer<typeof PhysicalPRSchema>;
```

### Validating the NFC signature matches the vendor authorized for THIS specific PR

The naive mistake would be "any valid Aporaksha tap from anyone authorizes any pending PR" — wrong,
and a real privilege-escalation risk (one vendor's registered device authorizing a competitor's
PR). The binding is enforced by requiring `physicalPrId` inside the verification request itself
(Phase 1's payload above already includes it — the vendor's client app must know which PR it's
authorizing before it prompts for the tap) and then a **server-side ownership check**, not just a
signature-validity check:

```
On POST /api/aporaksha/verify-tap:
  1. SUN verification passes (Phase 1) → yields vendorId bound to sunUid via the
     provisioning DB (the UID → vendor binding from Phase 4 below).
  2. Load PhysicalPR by physicalPrId from the request.
  3. REJECT (403, not a silent no-op) unless pr.vendorId === vendorId from step 1
     AND pr.status === 'PENDING_AUTH' AND now() < pr.authExpiresAt.
  4. Only after all three hold: transition pr.status → 'ROYALTY_PENDING', persist
     pr.aporakshaAuth, and enqueue the settlement trigger (Phase 3).

  Step 3's three-way check is the actual answer to "how does the backend
  validate the signature matches the authorized vendor for this PR" -- the
  cryptography (Phase 1) only proves WHICH physical device tapped; the
  ownership check is a separate, mandatory authorization step against the
  PR's own recorded vendorId, not inferred from the tap alone.
```

---

## Phase 3: Payment Routing & Royalty Execution

### Reusing real infrastructure, not inventing a new payment stack

`via/aporaksha/api/payments/create-order.js` already has a working Razorpay integration
(`razorpay.orders.create`, `razorpay.subscriptions.create`, writing `order_id`/`billing_status`
into the `passports` table). Royalty payout uses **Razorpay Route** (Razorpay's existing marketplace
split-payment product, built for exactly this creator/platform-cut shape) rather than introducing
a second payment processor — same SDK dependency already in `package.json`, same account.

```typescript
// Pseudocode -- payment_router.ts, triggered ONLY on the PR status transition
// into ROYALTY_PENDING (Phase 2 step 4), never earlier.

async function executeRoyaltySettlement(pr: PhysicalPR): Promise<void> {
  // Idempotency: commitSha256 IS the idempotency key. A retried webhook or a
  // duplicate trigger for the same PR must never double-pay -- check first.
  const existing = await db.query(
    'SELECT settlement_ref FROM royalty_settlements WHERE commit_sha256 = $1',
    [pr.commitSha256]
  );
  if (existing.rows.length > 0) return; // already settled, no-op

  const license = await getLicense(pr.royalty.licenseId); // schema from 01-hardware-bridge-spec.md Phase 4

  // Razorpay Route: platform account holds escrow (buyer/order payment already
  // captured earlier in the order lifecycle, via the EXISTING create-order.js
  // flow -- this function only executes the SPLIT, it doesn't collect funds).
  const transfer = await razorpay.transfers.create({
    account: license.licensor.razorpayRouteAccountId, // creator's linked sub-account
    amount: pr.royalty.amountMinorUnits,
    currency: pr.royalty.currency,
    notes: {
      physicalPrId: pr.id,
      commitSha256: pr.commitSha256,     // ties the payment record back to the
                                          // exact hardware-verified commit, so a
                                          // dispute can be resolved by re-checking
                                          // the original telemetry hash chain
    },
  });

  await db.query(
    `INSERT INTO royalty_settlements (commit_sha256, physical_pr_id, transfer_id, amount, currency)
     VALUES ($1, $2, $3, $4, $5)`,
    [pr.commitSha256, pr.id, transfer.id, pr.royalty.amountMinorUnits, pr.royalty.currency]
  );

  await updatePhysicalPRStatus(pr.id, 'ROYALTY_CONFIRMED');
  // MERGED is a separate, subsequent transition -- see below.
}
```

```
ROYALTY_CONFIRMED → MERGED is a deliberately separate, final transition (not
folded into the settlement function above) so that "funds moved" and "design's
public commit chain now includes this unit" remain two independently-auditable
events with their own timestamps -- a real dispute investigation needs to be
able to ask "was the money sent before or after the PR was publicly marked
merged" without that being definitionally the same instant.
```

### Fallback: smart-contract path (for vendors/creators outside Razorpay Route's supported geographies)

```typescript
// Same trigger point, same idempotency key (commitSha256), alternate rail.
async function executeRoyaltySettlementOnChain(pr: PhysicalPR): Promise<void> {
  const license = await getLicense(pr.royalty.licenseId);
  const tx = await royaltyContract.methods
    .settleRoyalty(
      ethers.utils.formatBytes32String(pr.commitSha256.slice(0, 32)), // on-chain event key
      license.licensor.walletAddress,
      pr.royalty.amountMinorUnits
    )
    .send({ from: PLATFORM_TREASURY_ADDRESS });
  // Same royalty_settlements insert as above, transfer_id = tx.transactionHash.
}
```

---

## Phase 4: Closed-Loop Hardware-to-Account Linking

### The real onboarding step: binding a UID to an account happens at first tap, not at purchase

Purchase (Razorpay order, existing flow) only proves "this account paid for a SmartTag Lite unit" —
it does NOT yet know *which* physical chip UID will end up in that buyer's hands (warehouse picks
inventory after the order, potentially days later). Binding UID → account happens at **first
authenticated tap**, using the SUN mechanism from Phase 1 — never by having the platform ask the
user to type in a UID by hand (a UID isn't a secret, and typing it in doesn't prove physical
possession the way a SUN tap does).

```
Onboarding flow (extends lib/passportEngine.js's existing
onboardingSteps: ["Order Confirmed", "Shipping Update", "NFC Setup Guide"]
for smarttag_lite_single -- this spec defines what "NFC Setup Guide" actually does):

  1. Order Confirmed (existing) — Razorpay order captured, passports row updated
     with order_id/billing_status (existing create-order.js code, unchanged).
  2. Shipping Update (existing) — fulfillment marks the order shipped; the
     WAREHOUSE, at pick time, records which physical UID went into which
     order's package (a simple order_id -> uid mapping written at pack time,
     NOT yet trusted as the account binding -- it's provisional until step 4
     proves physical possession).
  3. NFC Setup Guide (this spec): buyer's first tap, same SUN verification
     pipeline as Phase 1/2, but against a DIFFERENT endpoint
     (/api/aporaksha/claim-tag) that doesn't require an existing PENDING_AUTH
     PR -- it requires an authenticated logichub.app session instead.
  4. Backend cross-checks: does the tapped UID match the order_id -> uid
     mapping from step 2, AND does the tapping session belong to the account
     that placed that order? BOTH must hold -- this is what prevents a
     mis-shipped or intercepted-in-transit unit from binding to the wrong
     account even if someone else taps it first (their SESSION won't match
     the order's account, so claim-tag rejects it, independent of the tap's
     own cryptographic validity).
  5. On success: provisioning DB's UID -> vendorId/accountId binding (used by
     Phase 1 step "yields vendorId bound to sunUid") is written HERE, at claim
     time -- not at manufacture time, and not at purchase time. K_tag itself
     was already provisioned at manufacture (Phase 1) and never changes; only
     the UID-to-ACCOUNT mapping is set at this step.
```

```json
// POST /api/aporaksha/claim-tag — request/response
{
  "request": {
    "sunUid": "04A1B2C3D4E5F6",
    "encData": "8f3a...(hex)",
    "cmac": "2c19...(hex)"
    // no physicalPrId here -- this is account-claim, not PR-authorization
  },
  "response": {
    "claimed": true,
    "accountId": "acct_4471",
    "note": "UID bound to account. This tag can now authorize physical PRs for this account's vendor identity."
  }
}
```

### Why master keys (K_tag) are never at risk of interception here

- K_tag never transits the NFC link at all — SUN's whole design point is proving key possession via
  a MAC, not by ever transmitting the key. This is unaffected by whether the reading device (buyer's
  phone) is compromised.
- The provisioning DB holding K_tag is populated once, at manufacture time, by a process that never
  touches the public API surface — `claim-tag`/`verify-tap` only ever *read* K_tag server-side to
  verify a CMAC, they never accept or transmit it.
- The warehouse's order→UID mapping (step 2 above) is provisional and UID-only — it never touches
  K_tag either, so even a compromised fulfillment system can at most mis-associate a UID with an
  order, which step 4's session-match check catches, not exfiltrate a signing key.

---

# Part B: Three-Tier Dashboard Architecture

## Tech stack & real-time layer

- **Frontend**: Next.js (App Router) + React + Tailwind — matches `apps/web` already in this repo
  (`engineering/apps/web`, confirmed real via the merge history: `layout.tsx`, `page.tsx`,
  `product/ProductCanvas.tsx` already exist there). New dashboard routes live under
  `apps/web/src/app/dashboard/{seller,vendor,buyer}/`, not a separate app — reuses the existing
  Next.js build/deploy pipeline rather than standing up a second frontend project.
- **Real-time telemetry (Vendor Tier 2 specifically)**: raw WebSocket, not SSE — the telemetry
  workbench needs bidirectional flow (server pushes samples, client sends test-control commands
  like "abort test"), and sample rate (up to 1kHz IMU per `01-hardware-bridge-spec.md` Phase 1) is
  too high-frequency/binary-friendly for SSE's text-frame overhead. One WS connection per active
  test-bench session, server-side fan-out to any dashboard viewers of that same session.
- **Real-time for Seller Tier 1's "Live PR Feed"**: SSE is the right choice here instead — it's
  server-to-client-only (status updates, not bidirectional control), lower connection overhead for
  potentially many simultaneous creators watching, and auto-reconnects natively without custom
  client logic.
- **State management**: React Query (TanStack Query) for all REST-fetched state (PR lists, royalty
  history, license configs) — it already gives cache invalidation on mutation, which every
  dashboard here needs (approve a license change → royalty vault view must reflect it without a
  manual refetch). A lightweight WS-fed store (Zustand, matching the pattern already used in
  `zayvora-workspace/src/core/useWorkspaceStore.js` for exactly this kind of "live external stream
  feeding local UI state" problem) for the telemetry workbench's high-frequency data — React Query
  is the wrong tool for a 1kHz stream, it's built around request/response caching, not a live feed.

## Core data schemas

```typescript
// PhysicalPR — same object defined in Part A Phase 2, reused unchanged across
// all three dashboards (creator sees it in the Live PR Feed, vendor sees it in
// the Manufacturing Queue and NFC Release Terminal, buyer sees a read-only
// projection of it in the Order Pipeline). One schema, three views -- not
// three separate PR representations that could drift.

export interface TelemetryStreamPacket {
  schemaVersion: '1.0.0';
  testUuid: string;
  seq: number;              // monotonic packet sequence within this test --
                             // lets the client detect a dropped WS frame
                             // (gap in seq) and show a "signal lost" badge
                             // rather than silently rendering a stale graph
  deviceTimeUs: number;      // matches Phase 1's t_us -- NOT wall-clock, so
                              // the vendor dashboard's time-series x-axis is
                              // relative to test start, consistent with what
                              // actually gets hashed server-side
  imu: {
    ax: number; ay: number; az: number;   // already unit-converted to g for
    gx: number; gy: number; gz: number;   // display -- raw int16 (Phase 1's
                                            // on-wire format) is converted
                                            // SERVER-SIDE before the browser
                                            // ever sees it; the RAW bytes used
                                            // for hashing never touch this
                                            // display-only channel
  } | null;                                // null on packets carrying only
                                            // touch data (different sample
                                            // rates, Phase 1 -- IMU packets
                                            // and touch packets interleave,
                                            // not always both present)
  touch: {
    channelMask: number;       // 12-bit bitmask, matches MPR121 layout
    filtered: number[];        // 12 raw capacitance readings
  } | null;
  ruleDelta: {
    // computed server-side, streamed alongside raw data so the vendor
    // dashboard's PASS/FAIL indicator doesn't have to reimplement
    // evaluate_*_bounds() client-side (that logic must have exactly one
    // implementation, the firmware/backend one, per 01-hardware-bridge-spec.md's
    // determinism requirement -- the UI only ever displays a result, never
    // recomputes one)
    withinBounds: boolean;
    metric: string;            // e.g. "accel_peak_g"
    currentValue: number;
    boundMin: number;
    boundMax: number;
  }[];
  runningTelemetrySha256Partial: string | null; // updated once at test end,
                                                  // null throughout streaming
                                                  // (the real hash, Phase 3 of
                                                  // the hardware spec, is only
                                                  // ever computed over the
                                                  // COMPLETE file -- no partial/
                                                  // incremental hash is shown
                                                  // as if it were final)
}
```

## Tier 1: Seller Dashboard (IP Creators)

**Layout**: left nav (Repositories / Live PR Feed / Royalty Vault / Licensing), main panel,
persistent right-rail notification drawer for real-time PR events (SSE-fed) so a creator watching
a *different* tab still sees a toast when a vendor's test passes.

1. **Hardware Repositories** — file-tree browser (matches the pattern of GitHub's own repo file
   view, deliberately, since "GitHub-for-manufacturing" is the platform's own framing) with
   type-specific icons: CAD assemblies (`.step`/`.f3d`), firmware builds (`.uf2`, shows a "flash
   target: RP2040" badge), and a dedicated **RULES.yaml editor** — not a raw text editor, a
   structured form generated from the YAML schema (`01-hardware-bridge-spec.md` Phase 2) with
   inline range sliders for `min`/`max` bounds per IMU/touch metric, so a non-firmware creator can
   safely tighten a tolerance without hand-editing YAML syntax.

2. **Live PR Feed** — dense, scannable table/feed hybrid: each row is one physical PR, columns
   `Vendor | Status badge | Telemetry hash (truncated, click-to-copy full) | Duration | Updated`.
   Status badge color coding: `IN_PROGRESS` (amber, pulsing), `FAILED_TOLERANCE` (red), `PASSED`
   (green), `PENDING_AUTH` (blue, with a small NFC icon — signals "waiting on vendor's physical
   tap," distinct from other in-flight states so a creator knows nothing further is needed from
   their side). Clicking a row expands an inline build-log panel (SSE-streamed) without navigating
   away from the feed — creators watching multiple simultaneous vendor tests need to stay on this
   view.

3. **Royalty Vault** — top: three stat tiles (Pending Escrow / Confirmed This Period / Lifetime
   Total), each with a sparkline. Below: a ledger table, one row per `commitSha256` — deliberately
   granular (per physical unit, not aggregated by default) since the creator's trust in the system
   rests on being able to trace every dollar back to a specific hardware-verified commit; an
   "aggregate by day/vendor" toggle is available but per-unit is the default view, not hidden
   behind it.

4. **Licensing Controls** — a tier toggle (Non-Commercial DIY / Commercial Production) per
   repository, and for Commercial: the royalty amount input directly reuses the
   `ExecutableHardwareLicense` schema's `royalty` object (`01-hardware-bridge-spec.md` Phase 4) —
   the form IS the schema, not a separate UI model that gets translated into it, so there's no
   drift between what the creator configures and what actually gates settlement.

## Tier 2: Vendor Dashboard (Manufacturers)

**Layout**: three-pane workbench — left (Manufacturing Queue, collapsible once a job is claimed),
center (Live Telemetry Workbench, the dominant panel), right (NFC Release Terminal, only populated
once center panel reaches PASSED).

1. **Manufacturing Queue** — filterable card list (filters: repository, royalty tier, estimated
   test duration from `max_test_duration_s` in the target `RULES.yaml`). Each card shows a
   compact preview of the `RULES.yaml` bounds it'll be tested against BEFORE claiming — a vendor
   shouldn't discover the tolerance is unachievable with their bench setup only after starting a
   test run.

2. **Live Telemetry Workbench** — the highest data-density surface in the whole system, by design:
   - **MPR121 heatmap**: a 12-cell grid (matches physical channel layout on the hilt), each cell
     colored by a sequential (never diverging-rainbow) scale from the `TelemetryStreamPacket`'s
     `touch.filtered[]` values, with the cell's `channelMask` bit drawn as a filled/outlined
     border state — so "touched" (binary) and "capacitance magnitude" (continuous) are both
     visible without one obscuring the other.
   - **IMU time-series**: two stacked charts (accel, gyro), each with the live trace AND the
     `RULES.yaml` bound drawn as a shaded band behind it — the vendor sees the trace approach/cross
     the boundary in real time, not just a final pass/fail after the fact. X-axis is
     `deviceTimeUs`, matching the schema note above.
   - **PASS/FAIL delta indicator**: a single, large, unambiguous badge fed directly by
     `ruleDelta[].withinBounds` (never recomputed client-side, per the schema comment above) —
     flips red the instant any single metric goes out of bounds, doesn't wait for test end.
   - **SHA-256 hash display**: greyed-out/pending during the test ("Hash pending — test in
     progress"), populates with the real `telemetrySha256` only once
     `01-hardware-bridge-spec.md`'s Phase 3 pipeline completes server-side — never shows a partial
     or client-computed hash, exactly matching `runningTelemetrySha256Partial: null` in the schema.

3. **NFC Release Terminal** — a modal, not a separate page (deliberately blocking/modal, since
   this is the highest-stakes action in the vendor's flow): shows the final commit hash, the
   royalty amount about to be triggered, and a large "Tap Aporaksha to Authorize" prompt with a
   live NFC-reader status indicator (via Web NFC on mobile, or the desktop USB reader path). On
   successful tap → calls `/api/aporaksha/verify-tap` (Part A Phase 1/2) → modal transitions
   through `ROYALTY_PENDING → ROYALTY_CONFIRMED → MERGED` with a visible progress stepper, not a
   spinner — the vendor should see which of the three sub-steps (auth verified / funds routed /
   chain-of-custody updated) is currently in flight, since each can independently fail and the
   vendor needs to know which one to retry.

## Tier 3: Buyer / Subscriber Dashboard

**Layout**: storefront-style top-level nav (Catalog / Provenance Checker / My Orders), optimized
for scannability over density (unlike Tier 2 — this audience isn't staring at it all day).

1. **Verified Hardware Catalog** — standard storefront grid, but every listing card carries a
   "Verified Production Chain" badge only when the repository's active license tier is Commercial
   Production AND it has at least one `MERGED` physical PR — DIY-tier or zero-history repos show a
   distinct "Source Files Only" badge instead, so a buyer never mistakes an unverified DIY design
   for one with real hardware-tested provenance.

2. **Provenance Checker** — a single prominent input (accepts a scanned NFC UID via Web NFC on
   mobile, or manual UID entry) that resolves to a read-only genesis record: creator handle, exact
   vendor, `commitSha256` (with a "Verify" button that re-displays the full commit object from
   `01-hardware-bridge-spec.md` Phase 3 — creator, ruleset id/version, telemetry hash, pass
   metrics), and the `MERGED` timestamp. This is deliberately the SAME UID-lookup mechanism as
   Part A's account-binding (Phase 4) but a completely separate, unauthenticated read-only
   endpoint — a buyer checking provenance should never need to log in or prove anything themselves,
   only the ITEM's history needs to be provable, which is already guaranteed by the hash chain
   regardless of who's asking.

3. **Order Pipeline** — a horizontal stepper (not a table — buyers have one or a handful of active
   orders, not the volume density Tier 1/2 need): `Material Assigned → Test Bench Execution →
   Hardware Verified → NFC Sealed → Shipped`. Each step, once reached, shows its exact
   `PhysicalPR.status` transition timestamp pulled from the same schema Tier 1/2 use — the buyer is
   seeing a friendlier projection of the identical state machine, not a separately-tracked shipping
   status that could drift out of sync with the actual physical PR state.
