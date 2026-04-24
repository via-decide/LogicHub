/**
 * LogicHub Marketplace API (daxini core)
 * Viral App Distribution Engine
 */

import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// In-memory mock storage (replace with DB client later)
let apps: any[] = [];

/**
 * Trending Engine Calculation
 * trend_score = downloads_24h * 2 + downloads_total * 0.1
 */
function calculateTrendScore(downloads24h: number, downloadsTotal: number): number {
  return (downloads24h * 2) + (downloadsTotal * 0.1);
}

// GET: Retrieve trending apps
app.get("/apps", async (req, res) => {
  try {
    const zayvoraRes = await fetch("http://localhost:6000/rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apps })
    });
    const { sorted } = await zayvoraRes.json();
    res.json(sorted);
  } catch (err) {
    console.error("[Market] Zayvora Ranking failed, fallback to in-memory sort", err);
    const sorted = apps.sort((a, b) => b.trend_score - a.trend_score);
    res.json(sorted);
  }
});

// POST: Submit a new app
app.post("/submit", (req, res) => {
  const { name, slug, tagline, description, download_url, repo_url, publish } = req.body;
  
  // ZAYVORA PUBLISH GATE
  if (publish === false) {
    console.log(`[Market] Submission rejected by Zayvora Brain: ${name}`);
    return res.status(422).json({ error: "App failed quality evaluation" });
  }

  const newApp = {
    id: Date.now().toString(),
    name,
    slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
    tagline,
    description,
    download_url,
    repo_url,
    downloads: 0,
    downloads_24h: 0,
    trend_score: 0,
    created_at: new Date().toISOString(),
  };
  
  apps.push(newApp);
  console.log(`[Market] New app submitted: ${name}`);
  res.status(201).json(newApp);
});

// POST: Record a download and boost trend score
app.post("/download/:id", (req, res) => {
  const appItem = apps.find(a => a.id === req.params.id);
  
  if (appItem) {
    appItem.downloads++;
    appItem.downloads_24h++;
    appItem.trend_score = calculateTrendScore(appItem.downloads_24h, appItem.downloads);
    
    console.log(`[Market] Download tracked for ${appItem.name}. New trend score: ${appItem.trend_score.toFixed(2)}`);
    res.json({ success: true, trend_score: appItem.trend_score });
  } else {
    res.status(404).json({ error: "App not found" });
  }
});

const PORT = 4001;
app.listen(PORT, () => {
  console.log(`
  🚀 LogicHub Market API Running
  ──────────────────────────────
  Port: ${PORT}
  Mode: Development (Mock Storage)
  `);
});
