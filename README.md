# LogicHub ⚡

**The Visual Architecture Builder for the AI Era.**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Built with Vanilla JS](https://img.shields.io/badge/Tech-Vanilla%20JS-f1e05a.svg)]()
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-brightgreen.svg)]()

Every week, another "AI app builder" launches charging ₹999/month for locked-in drag-and-drop UI that generates bloated code you can never really own. 

**LogicHub is the antidote.** It is a free, open-source, visual logic-to-code builder. Instead of generating unreadable slop, it lets you visually map your app's architecture and instantly generates a **structured PRD (Product Requirements Document)**—a precise, architecture-level prompt designed perfectly for Claude or GPT.

Real infrastructure should be owned, not rented.

🌐 **[Try LogicHub Live Here](https://via-decide.github.io/LogicHub)**

---

## 🔥 Why LogicHub?

- 🔌 **No Templates:** Every node is highly configurable. You wire your exact product logic (inputs, compute, outputs).
- 📋 **Architecture First:** It outputs a master PRD, not a vague brief. You get the blueprint before the code.
- 🔑 **Bring Your Own Key (BYOK):** Want to synthesize code directly in-app? Drop in your Gemini API key. No middlemen marking up your tokens 10x.
- 📱 **PWA Ready:** Install it locally on your desktop or mobile. It works completely offline for PRD generation.
- 🪶 **Zero Build Steps:** Built as a single-file Vanilla JS application. No npm, no webpack, no bloat.

## 🛠️ How It Works

1. **Map Your Logic:** Drop nodes onto the canvas (`[UI]`, `[API]`, `[DB]`, `[AUTH]`).
2. **Wire & Configure:** Connect your dependencies and double-click to add specific AI instructions for each file.
3. **Generate PRD:** Click `[📋 PRD]` to instantly copy your architecture prompt. (This step is 100% free and local).
4. **Paste & Build:** Drop that PRD into Claude 3.5 Sonnet or GPT-4o. Your first prompt will pull a real, working app.

*Alternative Workflow:* Paste your Gemini API key into the header and click `[⚡ Synth]` to generate the code block-by-block directly in the browser, then hit `[📦 Export]` to download your `.zip` project.

## 🚀 Getting Started (Local Development)

Because LogicHub is 100% Vanilla JS, getting started takes about 3 seconds.

```bash
# 1. Clone the repository
git clone [https://github.com/via-decide/LogicHub.git](https://github.com/via-decide/LogicHub.git)

# 2. Navigate into the directory
cd LogicHub

# 3. Open index.html in your browser
# (You can just double-click it, or use a simple server like Live Server or python -m http.server)

🧩 Available Nodes
 * [UI] Component: React/Vue/HTML frontend components.
 * [API] Route: Backend endpoints (Express, FastAPI, etc.).
 * [DB] Schema: Database schemas (SQL, Prisma, Mongoose).
 * [AUTH] Layer: Authentication middleware and logic.
 * [UTIL] Helper: Utility functions and shared logic.
 * [CSS] Styles: Global or scoped styling.
 * [CFG] Config: Environment variables and setup files.
🤝 Philosophy
This is the difference between a real tool and a SaaS trap:
 * A tool respects your intelligence.
 * A product respects your money.
 * Subscription slop does neither.
LogicHub is built for developers who are tired of paying for the privilege of prompting.
📜 License
LogicHub is released under the Apache License 2.0. You are free to use it, modify it, and distribute it. See the LICENSE file for more details.
🌍 About the Builder
Built completely solo in Kutch, Gujarat, Bharat. Part of the ViaDecide ecosystem.
#BuildInBharat #OpenSource #SoloFounder

***

