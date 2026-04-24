/**
 * Zayvora Brain Orchestration Layer
 * Decision, Ranking, and Viral Control System
 */

import express from "express";

const app = express();
app.use(express.json());

// --- PHASE 1: BOOTSTRAP ---
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// --- PHASE 2: DECISION ENGINE ---
app.post("/evaluate", (req, res) => {
  const { repo_url, summary, features } = req.body;

  // MVP Logic Rules
  let publish = true;
  let score = 0;
  const tags: string[] = [];

  // Reject if summary too short
  if (!summary || summary.length < 40) {
    publish = false;
  }

  // Boost logic
  const keywords = ["AI", "tool", "free", "Zayvora"];
  keywords.forEach(word => {
    if (summary?.toLowerCase().includes(word.toLowerCase())) {
      score += 15;
      tags.push(word);
    }
  });

  // Length boost
  score += Math.min(summary?.length || 0, 50) * 0.5;

  res.json({
    publish,
    score: Math.min(score, 100),
    tags,
    hook: `🚀 Discover ${tags[0] || 'this'} masterpiece`,
    improved_summary: summary?.trim() + " (Verified by Zayvora)"
  });
});

app.post("/moderate", (req, res) => {
  const { repo_url, summary } = req.body;
  
  // Basic spam check
  const isSpam = summary?.toLowerCase().includes("spam") || !repo_url;
  
  res.json({ safe: !isSpam });
});

// --- PHASE 3: RANKING ENGINE ---
app.post("/rank", (req, res) => {
  const { apps } = req.body;
  if (!Array.isArray(apps)) return res.status(400).json({ error: "Invalid input" });

  const now = new Date();
  
  const sorted = [...apps].sort((a, b) => {
    // Formula: score = downloads_24h * 2 + downloads_total * 0.1 + zayvora_boost
    const getScore = (item: any) => {
      let score = (item.downloads_24h * 2) + (item.downloads * 0.1);
      
      // Freshness Boost (+20 if < 24h)
      const created = new Date(item.created_at);
      const diffHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
      if (diffHours < 24) score += 20;
      
      return score;
    };
    
    return getScore(b) - getScore(a);
  });

  res.json({ sorted });
});

// --- PHASE 4: SHARE ENGINE ---
app.post("/share", (req, res) => {
  const { app: appItem } = req.body;
  const link = `http://localhost:3001/app/${appItem.slug || appItem.id}`;
  
  res.json({
    tweet: `🚀 Found this insane app on LogicHub\n👉 ${link}\nBuilt with Zayvora #SovereignAI`,
    whatsapp: `Check this out: ${link}`,
    short: link
  });
});

const PORT = 6000;
app.listen(PORT, () => {
  console.log(`
  🧠 ZAYVORA BRAIN ONLINE
  ──────────────────────
  Port: ${PORT}
  Mode: Orchestrator Active
  `);
});
