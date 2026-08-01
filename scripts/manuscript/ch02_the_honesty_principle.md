# Chapter 2: The Honesty Principle

When you only have 8 MB, every single byte matters. But more importantly, the *meaning* of those bytes matters. 

In standard programming, it's really tempting to default missing data to zero. `const power = inputPower ?? 0;`. It keeps the UI from crashing, right? 

But in physical engineering, you must enforce a strict, unbreakable rule:

> **Missing data must never silently become zero. Unknown must never be treated as pass. A simulation is never reported as a measurement.**

## The Danger of Defaulting to Zero

Let's look at another real-life edge case. Imagine you are configuring a motor driver node in a virtual hardware graph. The power dissipation (`dissipationW`) depends on the current drawn by a downstream motor. But what if you forgot to connect the motor to the graph in the software?

If the software engine substitutes `0` for the missing current, it calculates `0W` for the driver's power dissipation. The thermal check then evaluates this `0W` against the ambient temperature and happily stamps a `PASS` on the project. 

Trusting the software, you send the design to be manufactured. You build the board, connect a real motor, and turn it on. The driver instantly draws 5 Amps, massively exceeds its thermal limit, and burns out. The software certified a dangerous design as safe, entirely because it lacked the data to prove otherwise.

## The Frugal, Honest Engine

A true engineering tool avoids this by explicitly tracking epistemic states. This gives small builders the exact same rigor that aerospace engineers use, scaled down to an accessible platform. For example, in the LogicHub engine:

| Scenario | Standard App Response | Frugal Engineering Response |
| :--- | :--- | :--- |
| Missing Driver Load | Defaults to `0` Amps | Throws `UNKNOWN` state |
| Missing Thermal Data | Defaults to `Safe` | Engine evaluation fails |
| Simulated Estimate | Presented as Truth | Flagged as `REQUIRES_VALIDATION` |

If a driver has no motor below it, its dissipation is fundamentally absent (`undefined`). You can completely drop the `undefined` values when serializing to save space on the flash memory, but during evaluation, it must propagate up the graph as an `UNKNOWN` state. You must refuse to guess.

How do you compress all this honest data into less than 8 MB while remaining perfectly reproducible? We'll tackle that in [Chapter 3: Architecture and Determinism](#chapter-3-architecture-and-determinism).
