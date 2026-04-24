# LogicHub: Viral App Distribution Engine

A self-propagating app distribution system built to turn repo viewers into a viral marketplace.

## Architecture

- **`apps/web`**: Next.js 15 Frontend (The Traffic Magnet)
- **`apps/api`**: Node.js/Express Marketplace Engine (daxini core)
- **`apps/ai-service`**: AI Content Storyteller (git-history-llm core)

## Tech Stack

- **Frontend**: Next.js, TailwindCSS, React
- **Backend**: Express, Node.js
- **Database**: PostgreSQL (Schema in `packages/db/schema.sql`)
- **Intelligence**: Zayvora local brain integration

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run Services (Development)**
   ```bash
   # Run all services in parallel
   npm run dev
   ```

   Individual ports:
   - Web: `http://localhost:3001`
   - Market API: `http://localhost:4001`
   - AI Service: `http://localhost:5001`

## Viral Loop Machine

1. **Submission**: Paste a GitHub repo URL.
2. **Analysis**: AI analyzes the repo and generates a viral story.
3. **Publication**: App is instantly published to the marketplace.
4. **Distribution**: Users download and share with one click.
5. **Growth**: Trending engine boosts high-velocity apps automatically.

---
**Built by Antigravity Synthesis Orchestrator**
