/**
 * LogicHub Marketplace API (daxini core)
 * Viral App Distribution Engine
 */

import express from "express";
import cors from "cors";
import { redis } from "../../../packages/infra/redis/client.js";
import { rateLimit } from "../../../packages/infra/middleware/rateLimit.js";

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
  // 1. Check Cache
  const cached = await redis.get("trending_apps");
  if (cached) return res.json(JSON.parse(cached));

  try {
    const zayvoraRes = await fetch("http://localhost:6000/rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apps })
    });
    const { sorted } = await zayvoraRes.json();
    
    // 2. Set Cache (TTL 60s)
    await redis.set("trending_apps", JSON.stringify(sorted), "EX", 60);
    
    res.json(sorted);
  } catch (err) {
    console.error("[Market] Zayvora Ranking failed, fallback to in-memory sort", err);
    const sorted = apps.sort((a, b) => b.trend_score - a.trend_score);
    res.json(sorted);
  }
});

// POST: Submit a new app
app.post("/submit", async (req, res) => {
  const ip = req.ip || "unknown";
  try {
    await rateLimit(ip, 10, 3600); // Max 10 submissions per hour
  } catch (err) {
    return res.status(429).json({ error: "Slow down! Too many submissions." });
  }

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
app.post("/download/:id", async (req, res) => {
  const ip = req.ip || "unknown";
  try {
    await rateLimit(ip, 100, 60); // Max 100 downloads per minute per IP
  } catch (err) {
    return res.status(429).json({ error: "Too many download requests." });
  }

  const appItem = apps.find(a => a.id === req.params.id);
  
  if (appItem) {
    // High-speed tracking in Redis
    await redis.incr(`downloads:${appItem.id}`);
    await redis.lpush("activity", JSON.stringify({
      type: "download",
      app: appItem.name,
      time: new Date().toISOString()
    }));
    await redis.ltrim("activity", 0, 19); // Keep last 20 activities

    appItem.downloads++;
    appItem.downloads_24h++;
    appItem.trend_score = calculateTrendScore(appItem.downloads_24h, appItem.downloads);
    
    // Invalidate trending cache
    await redis.del("trending_apps");

    console.log(`[Market] Download tracked for ${appItem.name}. New trend score: ${appItem.trend_score.toFixed(2)}`);
    res.json({ success: true, trend_score: appItem.trend_score });
  } else {
    res.status(404).json({ error: "App not found" });
  }
});

app.get("/activity", async (req, res) => {
  const feed = await redis.lrange("activity", 0, 20);
  res.json(feed.map(f => JSON.parse(f)));
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
