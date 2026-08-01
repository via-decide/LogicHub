# Chapter 3: Architecture and Determinism

If you and I build the exact same battery pack configuration on two different computers, at two different times of day, the resulting configuration file that we write to the 8 MB cartridge must be **byte-for-byte identical**.

This is called determinism, and it is incredibly hard to achieve in modern software. For a beginner, this might seem like academic overkill. "Why does it matter if my files are a few bytes different?"

It matters because in hardware manufacturing, a changed byte implies a changed physical reality. If your outputs aren't deterministic, you can't definitively prove that the firmware you tested is the firmware you are shipping. 

## Environmental Entropy

Modern environments leak entropy everywhere. Wall-clock timestamps, random UUID generation, and unordered dictionary keys mean that standard JSON output is never the same twice. When you are writing to a highly constrained SPI NOR flash, this entropy ruins data deduplication and makes cryptographic signing a nightmare.

Imagine compiling a project twice. The first time, it works. The second time, a random UUID generator changes a dependency ID, breaking the linker. You waste three days debugging a hardware issue that was actually a software entropy issue.

## Canonical JSON: The Frugal Serializer

To squeeze a hardware graph into the 8 MB target while maintaining perfect reproducibility, strict systems like LogicHub use Canonical JSON.

Let's look at what standard JSON does versus Canonical JSON:

| Feature | Standard `JSON.stringify` | Canonical JSON |
| :--- | :--- | :--- |
| **Object Keys** | Unordered (based on insertion) | Recursively sorted alphabetically |
| **Floats** | System-dependent (`-0` vs `0`) | Normalized (`-0` becomes `"0"`) |
| **Missing Values** | Writes `"key": null` | Drops the key completely |
| **IDs** | Random UUIDs | Hashes based on topology |

By dropping `undefined` values completely and stripping out wall-clock timestamps from node IDs, you achieve two things:
1. **Reproducibility**: The output bytes are identical every single time.
2. **Compression**: You stay well inside the 8 MB target, leaving room for what really matters: crash diagnostics and telemetry. 

We cover why that extra space is vital in [Chapter 4: The Telemetry Loop](#chapter-4-the-telemetry-loop).
