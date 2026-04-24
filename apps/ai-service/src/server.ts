/**
 * LogicHub AI Story Engine (git-history-llm core)
 * Viral Content Generator
 */

import express from "express";

const app = express();
app.use(express.json());

app.post("/analyze", async (req, res) => {
  const { repo_url } = req.body;
  console.log(`[AI-Service] Analyzing repo: ${repo_url}`);

  // 1. MOCK AI OUTPUT (In production, this calls Zayvora/Ollama)
  const aiResult = {
    title: "I built this using Zayvora",
    tagline: "Instantly usable repo-to-app conversion",
    summary: "This project solves a real problem and is instantly usable. It was synthesized using the Antigravity Apex Engine.",
    features: [
      "Zero-Auth required for use",
      "Fast local execution",
      "High-precision reasoning traces"
    ]
  };

  // 2. CALL ZAYVORA BRAIN for evaluation
  try {
    const zayvoraRes = await fetch("http://localhost:6000/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repo_url,
        summary: aiResult.summary,
        features: aiResult.features
      })
    });
    const zayvoraData = await zayvoraRes.json();

    // 3. MERGE Results
    const finalResult = {
      ...aiResult,
      ...zayvoraData,
      title: aiResult.title // keep original title
    };

    res.json(finalResult);
  } catch (err) {
    console.error("[AI-Service] Zayvora Brain unreachable", err);
    res.json({ ...aiResult, publish: true }); // Fallback to publish
  }
});

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`
  🧠 LogicHub AI Story Engine Running
  ──────────────────────────────────
  Port: ${PORT}
  Mode: git-history-llm emulation
  `);
});
