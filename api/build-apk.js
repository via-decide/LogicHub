export const maxDuration = 300; // 5 minutes to prevent 504 Gateway Timeout
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APK_OUTPUT_RELATIVE_PATH = "app/build/outputs/apk/debug/app-debug.apk";

async function runCommand(cmd, args, cwd) {
  await execFileAsync(cmd, args, {
    cwd,
    maxBuffer: 1024 * 1024 * 32
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Ecosystem-Uid');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { zipBase64, mapId = "VIBE_APP" } = req.body || {};
  if (!zipBase64) {
    return res.status(400).json({ error: "Missing zipBase64 payload." });
  }

  const zayvoraUrl = process.env.ZAYVORA_TUNNEL_URL || "http://localhost:8080";
  const zayvoraToken = process.env.ZAYVORA_SECURE_TOKEN || "DEFAULT_LOGICHUB_SECURE_TOKEN";

  try {
    const zayvoraRes = await fetch(`${zayvoraUrl}/api/zayvora/build-apk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${zayvoraToken}`
      },
      body: JSON.stringify({ zipBase64, mapId })
    });

    const data = await zayvoraRes.json();

    if (!zayvoraRes.ok) {
      return res.status(zayvoraRes.status).json({ error: data.error || "Zayvora APK build failed." });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("Zayvora proxy error:", error);
    return res.status(500).json({ error: "Failed to connect to Zayvora Sovereign Engine" });
  }
}
