// /api/publish.js — LogicHub Publish Pipeline
//
// Flow:
//   1. Receive { appName, prdContext, username, internalPRD }
//   2. Call Gemini to synthesise the app HTML
//   3. Commit to via-decide/LogicHub → artifacts/{username}/{slug}/index.html
//   4. Also write artifacts/{username}/{slug}/meta.json
//   5. Return share URL: https://logichub.app/view?u={username}&p={slug}
//
// Required env vars (Vercel → Settings → Environment Variables):
//   GEMINI_API_KEY   — server-side Gemini key (community tier)
//   GITHUB_TOKEN     — Fine-grained PAT with Contents: write on via-decide/LogicHub

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { appName, prdContext, username = 'anonymous', internalPRD = '' } = req.body || {};

  if (!appName || !prdContext) {
    return res.status(400).json({ error: 'Missing appName or prdContext' });
  }

  const base = appName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;

  // ── PHASE 1: GEMINI SYNTHESIS ────────────────────────────────────────────────
  const systemBase = [
    'You are the Daxini LogicHub engine.',
    'The user provides an Architecture PRD.',
    'Output a fully working, self-contained single-file HTML application.',
    'Use Vanilla JS and CSS only — no external frameworks.',
    'Dark aesthetic: background #030508, accent #00e5ff.',
    'Output ONLY raw HTML. No markdown fences, no explanation.',
  ].join(' ');

  const systemInstruction = internalPRD?.trim()
    ? `${systemBase}\n\n# INTERNAL PRD MODIFIERS\n${internalPRD.trim()}`
    : systemBase;

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  let generatedHTML;
  try {
    const gRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ parts: [{ text: prdContext }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
        }),
      }
    );
    const gData = await gRes.json();
    if (gData.error) throw new Error('Gemini: ' + gData.error.message);
    generatedHTML = (gData.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim()
      .replace(/^```html?\n?/, '').replace(/\n?```$/, '');
    if (!generatedHTML.includes('<')) throw new Error('Gemini returned empty/non-HTML output');
  } catch (err) {
    return res.status(500).json({ error: 'Synthesis failed: ' + err.message });
  }

  // ── PHASE 2: COMMIT TO GITHUB ────────────────────────────────────────────────
  const ghToken = process.env.GITHUB_TOKEN;
  if (!ghToken) return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });

  const REPO   = 'via-decide/LogicHub';
  const BRANCH = 'main';
  const DIR    = `artifacts/${username}/${slug}`;

  const meta = JSON.stringify({
    appName, username, slug,
    createdAt: new Date().toISOString(),
    shareUrl:  `https://logichub.app/view?u=${username}&p=${slug}`,
  }, null, 2);

  async function ghPut(path, content, message) {
    const url = `https://api.github.com/repos/${REPO}/contents/${path}`;
    const encoded = Buffer.from(content).toString('base64');
    let sha;
    try {
      const chk = await fetch(url, {
        headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github.v3+json' }
      });
      if (chk.ok) sha = (await chk.json()).sha;
    } catch (_) {}
    const body = { message, content: encoded, branch: BRANCH };
    if (sha) body.sha = sha;
    const r = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${ghToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(`GitHub (${r.status}): ${d.message}`);
    return d;
  }

  try {
    await ghPut(`${DIR}/index.html`, generatedHTML, `publish: ${appName} by @${username}`);
    await ghPut(`${DIR}/meta.json`,  meta,           `meta: ${appName} by @${username}`);
  } catch (err) {
    return res.status(500).json({ error: 'GitHub commit failed: ' + err.message });
  }

  // ── PHASE 3: RETURN ──────────────────────────────────────────────────────────
  const shareUrl = `https://logichub.app/view?u=${username}&p=${slug}`;
  return res.status(200).json({
    success: true, shareUrl, username, slug, appName,
    repoUrl: `https://github.com/${REPO}/tree/${BRANCH}/${DIR}`,
  });
}
