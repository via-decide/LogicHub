# Chapter 6: Managing Power States

In software, a crashed application can usually be restarted by a supervisor like PM2 or systemd. In hardware, a "crash" often means a complete power brownout. If a motor draws more current than the battery can provide, the voltage rail sags, and the microcontroller simply turns off mid-computation. 

## The Reality of Brownouts

When a beginner first designs a hardware circuit, they assume the 3.3V rail will always be exactly 3.3V. But in the physical world, activating a high-power peripheral (like a radio transmission or a motor spike) can cause the voltage to temporarily drop to 2.7V. 

If your microcontroller requires a minimum of 2.9V to operate its flash memory correctly, the system will undergo a "Brownout Reset." 

This is why your deterministic hardware graph cannot just specify the *components*. It must specify the *timing* and *power states*. 

## Task Isolation and RTOS

In embedded engineering, we solve this by isolating time-critical tasks using a Real-Time Operating System (RTOS). 

If a telemetry system blocks a hardware timer to write a log to the SPI NOR flash, and simultaneously the motor controller demands peak current, the entire system can fail. The architecture must enforce task isolation:
1. **Critical Path**: Motor control loops and safety limits run on high-priority, uninterruptible threads.
2. **Background Path**: Telemetry and flash storage operations are queued and executed only when power margins are safe.

You cannot rely on web-development asynchronous patterns (like standard Javascript Promises) to manage these physical tasks. The physical world demands absolute certainty about *when* a task will execute, not just *how*. 

All of these strict rules—from memory constraints to power states—must be proven to work before manufacturing begins. That brings us to our final step: [Chapter 7: Verification and Production](#chapter-7-verification-and-production).
