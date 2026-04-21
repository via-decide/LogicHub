import admin from "firebase-admin";
import { getAdminDb, logRuntimeEvent } from "./_firebaseAdmin.js";

function toBase64(value) {
  return Buffer.from(value).toString('base64');
}

function fromBase64(value) {
  return Buffer.from(value, 'base64').toString('utf8');
}

function normalizeSlug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `app-${Date.now()}`;
}

function validateBundle(bundle) {
  const files = bundle && bundle.build ? bundle.build : {};
  const required = ['index.html', 'app.js', 'style.css', 'manifest.json', 'metadata.json'];
  const missing = required.filter((name) => !files[name]);
  if (missing.length) throw new Error(`Missing required bundle files: ${missing.join(', ')}`);

  if (!/<html[\s>]/i.test(files['index.html']) || !/<body[\s>]/i.test(files['index.html'])) {
    throw new Error('Invalid HTML structure. index.html requires html/body tags.');
  }

  const jsBytes = Buffer.byteLength(String(files['app.js'] || ''), 'utf8');
  if (jsBytes > 512 * 1024) throw new Error('JavaScript size exceeds 512KB limit.');

  if (/eval\s*\(|new\s+Function\s*\(/i.test(String(files['index.html']) + '\n' + String(files['app.js']))) {
    throw new Error('Unsafe script execution pattern detected.');
  }
}

function validatePublishMetadata(metadata = {}) {
  const required = ["name", "description", "icon", "entryUrl", "permissions", "creatorId"];
  const missing = required.filter((key) => {
    const value = metadata[key];
    if (Array.isArray(value)) return value.length === 0;
    return !String(value || "").trim();
  });
  if (missing.length) {
    const error = new Error("missing required app metadata");
    error.statusCode = 400;
    error.missing = missing;
    throw error;
  }
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

async function putGitHubFile(ownerRepo, path, token, message, content, sha) {
  const response = await fetch(`https://api.github.com/repos/${ownerRepo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json'
    },
    body: JSON.stringify({
      message,
      content: toBase64(content),
      branch: 'main',
      ...(sha ? { sha } : {})
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `Failed to write ${path}`);
  return data;
}

async function updateRegistry({ githubRepo, githubToken, registryItem }) {
  const path = 'apps/registry.json';
  const existing = await getGitHubFile(githubRepo, path, githubToken);
  let registry = { apps: [], updatedAt: new Date().toISOString(), source: 'logichub-publish' };
  if (existing?.content) {
    try {
      registry = JSON.parse(fromBase64(existing.content.replace(/\n/g, '')));
    } catch (error) {
      registry = { apps: [], updatedAt: new Date().toISOString(), source: 'logichub-publish' };
    }
  }

  const apps = Array.isArray(registry.apps) ? registry.apps : [];
  const withoutCurrent = apps.filter((app) => app.slug !== registryItem.slug);
  const next = {
    apps: [registryItem, ...withoutCurrent].slice(0, 300),
    updatedAt: new Date().toISOString(),
    source: 'logichub-publish'
  };

  await putGitHubFile(
    githubRepo,
    path,
    githubToken,
    `LogicHub Marketplace: register ${registryItem.name}`,
    JSON.stringify(next, null, 2),
    existing?.sha
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  const bundle = req.body?.bundle;
  const incomingMetadata = req.body?.metadata || {};
  if (!bundle || !incomingMetadata?.name) return res.status(400).json({ error: 'Missing bundle or metadata.' });

  try {
    validateBundle(bundle);
    validatePublishMetadata(incomingMetadata);

    const slug = normalizeSlug(incomingMetadata.slug || incomingMetadata.name);
    const githubRepo = 'via-decide/daxini.space';
    const githubToken = process.env.GITHUB_TOKEN;
    const files = bundle.build;

    const appId = `app_${Math.floor(100000 + Math.random() * 900000)}`;
    const metadata = {
      appId,
      name: String(incomingMetadata.name),
      description: String(incomingMetadata.description),
      icon: String(incomingMetadata.icon),
      entryUrl: String(incomingMetadata.entryUrl),
      permissions: Array.isArray(incomingMetadata.permissions) ? incomingMetadata.permissions : [],
      creatorId: String(incomingMetadata.creatorId),
      creator: String(incomingMetadata.creator || 'username'),
      origin: 'logichub',
      version: String(incomingMetadata.version || '1.0'),
      slug,
      appUrl: `https://daxini.space/apps/${slug}`,
      source: 'logichub',
      publishedAt: new Date().toISOString()
    };

    const fileEntries = [
      [`apps/${slug}/index.html`, files['index.html']],
      [`apps/${slug}/app.js`, files['app.js']],
      [`apps/${slug}/style.css`, files['style.css']],
      [`apps/${slug}/manifest.json`, files['manifest.json']],
      [`apps/${slug}/metadata.json`, JSON.stringify(metadata, null, 2)],
      [`apps/${slug}/architecture.json`, JSON.stringify({ prd: bundle.architecture_prd || '' }, null, 2)]
    ];

    for (const [path, content] of fileEntries) {
      const existing = await getGitHubFile(githubRepo, path, githubToken);
      await putGitHubFile(githubRepo, path, githubToken, `LogicHub Publish: ${metadata.name} (${slug})`, String(content || ''), existing?.sha);
    }

    await updateRegistry({
      githubRepo,
      githubToken,
      registryItem: {
        slug,
        name: metadata.name,
        creator: metadata.creator,
        appUrl: metadata.appUrl,
        source: 'logichub',
        publishedAt: metadata.publishedAt
      }
    });
    const db = getAdminDb();
    await db.collection("apps").doc(appId).set({
      app_id: appId,
      creator_id: metadata.creatorId,
      title: metadata.name,
      description: metadata.description,
      entry_url: metadata.entryUrl,
      icon: metadata.icon,
      permissions: metadata.permissions,
      slug,
      source: "logichub",
      created_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    await logRuntimeEvent("publish_attempt", { appId, slug, creatorId: metadata.creatorId, status: "success" });

    return res.status(200).json({
      success: true,
      appId,
      slug,
      url: metadata.appUrl
    });
  } catch (error) {
    console.error('Publish endpoint error:', error);
    await logRuntimeEvent("publish_attempt_error", { message: error?.message || "Publish failed." });
    return res.status(error.statusCode || 500).json({
      error: error.statusCode === 400 ? error.message : `Publish failed: ${error.message}`,
      missing: error.missing || []
    });
  }
}
