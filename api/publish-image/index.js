// /api/publish-image/index.js (Vercel Serverless Function)
//
// Pipeline: description -> buildImageBrief (creator-tool) -> generator
//   -> packZayFile (zayvora-toolkit) -> commit to daxini.space + registry update.
//
// Required env: GITHUB_TOKEN. Optional: IMAGE_API_URL, IMAGE_API_KEY (real generator).
// When IMAGE_API_URL is unset, a 1x1 placeholder PNG is committed so the round
// trip is verifiable without an external model.

import { buildImageBrief } from '../../../creator-tool/engine/image-engine.js';
import { packZayFile } from '../../../zayvora-toolkit/pipeline/image-pipeline.js';

const ALLOWED_ORIGINS = new Set([
  'https://daxini.space',
  'https://www.daxini.space',
  'http://localhost:3000'
]);

function setCors(req, res) {
  const origin = req.headers?.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

function toBase64(value) {
  return Buffer.from(value).toString('base64');
}

function fromBase64(value) {
  return Buffer.from(value, 'base64').toString('utf8');
}

function createSlug(name) {
  const base = String(name || 'image').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${base || 'image'}-${Math.floor(Math.random() * 100000)}`;
}

function inferTags(brief) {
  const text = `${brief.subject} ${brief.style} ${brief.details}`.toLowerCase();
  const rules = {
    image: ['image', 'photo', 'picture'],
    landscape: ['landscape', 'mountain', 'forest', 'ocean', 'sunset', 'sunrise'],
    portrait: ['portrait', 'face', 'person'],
    art: ['watercolor', 'oil', 'sketch', 'anime', 'pixel'],
    cyberpunk: ['cyberpunk', 'neon', 'futuristic']
  };
  const tags = Object.entries(rules)
    .filter(([, needles]) => needles.some((n) => text.includes(n)))
    .map(([t]) => t);
  if (!tags.includes('image')) tags.unshift('image');
  return [...new Set(tags)].slice(0, 6);
}

async function getGitHubFile(ownerRepo, path, token) {
  const response = await fetch(`https://api.github.com/repos/${ownerRepo}/contents/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json'
    }
  });
  if (response.status === 404) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `Failed to read ${path}`);
  return data;
}

async function putGitHubFile(ownerRepo, path, token, message, contentBase64, sha) {
  const response = await fetch(`https://api.github.com/repos/${ownerRepo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json'
    },
    body: JSON.stringify({
      message,
      content: contentBase64,
      branch: 'main',
      ...(sha ? { sha } : {})
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `Failed to write ${path}`);
  return data;
}

async function updateImageRegistry({ githubRepo, githubToken, metadata }) {
  const registryPath = 'apps/images_registry.json';
  const existing = await getGitHubFile(githubRepo, registryPath, githubToken);
  let registry = { apps: [], updatedAt: new Date().toISOString(), source: 'logichub-image-publish' };
  if (existing?.content) {
    try {
      registry = JSON.parse(fromBase64(existing.content.replace(/\n/g, '')));
    } catch {
      registry = { apps: [], updatedAt: new Date().toISOString(), source: 'logichub-image-publish' };
    }
  }
  const apps = Array.isArray(registry.apps) ? registry.apps : [];
  const withoutCurrent = apps.filter((app) => app.slug !== metadata.slug);
  const next = {
    apps: [metadata, ...withoutCurrent].slice(0, 200),
    updatedAt: new Date().toISOString(),
    source: 'logichub-image-publish'
  };
  await putGitHubFile(
    githubRepo,
    registryPath,
    githubToken,
    `LogicHub Image Registry: indexed ${metadata.name}`,
    toBase64(JSON.stringify(next, null, 2)),
    existing?.sha
  );
}

const PLACEHOLDER_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4//8/AwAI/AL+XJ/QcQAAAABJRU5ErkJggg==';

async function generateImage(brief) {
  const url = process.env.IMAGE_API_URL;
  const key = process.env.IMAGE_API_KEY;
  if (!url || !key) {
    return { mime: 'image/png', bytes: Buffer.from(PLACEHOLDER_PNG_BASE64, 'base64') };
  }
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ prompt: brief.finalPrompt, negative_prompt: brief.negatives.join(', '), seed: brief.seed })
  });
  if (!r.ok) throw new Error(`Image API ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return { mime: 'image/png', bytes: buf };
}

function viewerHtml(slug, ext, brief) {
  const safeSubject = String(brief.subject || slug).replace(/[<>&"']/g, '');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${safeSubject}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;background:#030508;color:#e6e9ef;font:14px/1.4 system-ui;display:grid;place-items:center;min-height:100vh}main{max-width:960px;padding:24px;text-align:center}img{max-width:100%;height:auto;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.5)}h1{font-weight:500;margin:16px 0 4px}p{opacity:.6;margin:0}</style>
</head><body><main>
<img src="image.${ext}" alt="${safeSubject}">
<h1>${safeSubject}</h1>
<p>${String(brief.style || '').replace(/[<>&"']/g, '')} &middot; ${String(brief.aspect || '').replace(/[<>&"']/g, '')}</p>
</main></body></html>`;
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  const { description, options } = req.body || {};
  if (!description || typeof description !== 'string') {
    return res.status(400).json({ error: 'Missing description' });
  }

  const githubRepo = 'via-decide/daxini.space';
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) return res.status(500).json({ error: 'Image Publish Failed: missing GITHUB_TOKEN' });

  try {
    const brief = buildImageBrief(description, options || {});
    if (!brief) return res.status(400).json({ error: 'Empty or invalid description' });

    const slug = createSlug(brief.subject);
    const briefWithSlug = { ...brief, slug };

    const image = await generateImage(brief);
    const ext = (image.mime || 'image/png').split('/')[1] || 'png';
    const zay = packZayFile(briefWithSlug, image);

    const tags = inferTags(brief);
    const createdAt = new Date().toISOString();
    const metadata = {
      slug,
      name: brief.subject || slug,
      icon: '🖼️',
      url: `https://daxini.space/apps/${slug}/index.html`,
      status: 'live',
      desc: brief.details.slice(0, 140),
      ownerType: 'community',
      tier: 'free',
      source: 'logichub-image-publish',
      kind: 'image',
      tags,
      createdAt
    };

    await putGitHubFile(
      githubRepo,
      `apps/${slug}/image.${ext}`,
      githubToken,
      `LogicHub Image: asset for ${slug}`,
      image.bytes.toString('base64')
    );
    await putGitHubFile(
      githubRepo,
      `apps/${slug}/index.html`,
      githubToken,
      `LogicHub Image: viewer for ${slug}`,
      toBase64(viewerHtml(slug, ext, brief))
    );
    await putGitHubFile(
      githubRepo,
      `apps/${slug}/${slug}.zay`,
      githubToken,
      `LogicHub Image: provenance for ${slug}`,
      zay.bytes.toString('base64')
    );
    await putGitHubFile(
      githubRepo,
      `apps/${slug}/meta.json`,
      githubToken,
      `LogicHub Image: meta for ${slug}`,
      toBase64(JSON.stringify({ slug, kind: 'image', brief: briefWithSlug, tags, createdAt }, null, 2))
    );

    await updateImageRegistry({ githubRepo, githubToken, metadata });

    return res.status(200).json({
      success: true,
      url: metadata.url,
      slug,
      registry: 'apps/images_registry.json',
      tags
    });
  } catch (error) {
    console.error('Image Publish Error:', error);
    return res.status(500).json({ error: 'Image Publish Failed: ' + error.message });
  }
}
