// /api/publish.js (Vercel Serverless Function - GEMINI ENGINE)

function toBase64(value) {
  return Buffer.from(value).toString('base64');
}

function fromBase64(value) {
  return Buffer.from(value, 'base64').toString('utf8');
}

function createSlug(appName) {
  return `${appName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Math.floor(Math.random() * 100000)}`;
}

function inferTags(appName, prdContext, internalPRD = '') {
  const text = `${appName} ${prdContext} ${internalPRD}`.toLowerCase();
  const tagRules = {
    prompt: ['prompt', 'prompts', 'chatgpt', 'llm', 'gpt', 'copywriting'],
    workflow: ['workflow', 'automation', 'agent', 'pipeline', 'process'],
    study: ['study', 'exam', 'quiz', 'flashcard', 'learn', 'education'],
    research: ['research', 'analysis', 'paper', 'report', 'summary'],
    video: ['video', 'youtube', 'screen recording', 'movie', 'clip'],
    image: ['image', 'photo', 'poster', 'design', 'gallery'],
    finance: ['finance', 'sales', 'pricing', 'revenue', 'budget'],
    document: ['document', 'pdf', 'sop', 'guide', 'manual'],
    builder: ['app', 'builder', 'website', 'landing page', 'tool'],
    logic: ['logic', 'decision', 'matrix', 'planner'],
    game: ['game', 'play', 'simulation'],
    auth: ['login', 'auth', 'account', 'sign in'],
    database: ['database', 'schema', 'sql', 'table']
  };

  const tags = Object.entries(tagRules)
    .filter(([, needles]) => needles.some((needle) => text.includes(needle)))
    .map(([tag]) => tag);

  return [...new Set(tags.length ? tags : ['builder'])].slice(0, 6);
}

function inferIcon(tags) {
  if (tags.includes('prompt')) return '⚗️';
  if (tags.includes('study')) return '📚';
  if (tags.includes('video')) return '🎬';
  if (tags.includes('finance')) return '📈';
  if (tags.includes('research')) return '🔎';
  if (tags.includes('workflow')) return '🧠';
  if (tags.includes('game')) return '🕹️';
  if (tags.includes('document')) return '📄';
  return '✨';
}

function inferDescription(appName, prdContext) {
  const flattened = String(prdContext || '').replace(/\s+/g, ' ').trim();
  const withoutMarkdown = flattened
    .replace(/^#+\s*/g, '')
    .replace(/[*_`>#-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const sentence = withoutMarkdown.slice(0, 140).trim();
  if (sentence) return sentence;
  return `${appName} published from LogicHub free tier.`;
}

async function getGitHubFile(ownerRepo, path, token) {
  const response = await fetch(`https://api.github.com/repos/${ownerRepo}/contents/${path}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (response.status === 404) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `Failed to read ${path}`);
  return data;
}

async function putGitHubFile(ownerRepo, path, token, message, content, sha = undefined) {
  const response = await fetch(`https://api.github.com/repos/${ownerRepo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json'
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

async function updateCommunityRegistry({ githubRepo, githubToken, metadata }) {
  const registryPath = 'apps/registry.json';
  const existing = await getGitHubFile(githubRepo, registryPath, githubToken);
  let registry = { apps: [], updatedAt: new Date().toISOString(), source: 'logichub-publish' };

  if (existing?.content) {
    try {
      registry = JSON.parse(fromBase64(existing.content.replace(/\n/g, '')));
    } catch (error) {
      registry = { apps: [], updatedAt: new Date().toISOString(), source: 'logichub-publish' };
    }
  }

  const apps = Array.isArray(registry.apps) ? registry.apps : [];
  const withoutCurrent = apps.filter((app) => app.slug !== metadata.slug);
  const nextRegistry = {
    apps: [metadata, ...withoutCurrent].slice(0, 200),
    updatedAt: new Date().toISOString(),
    source: 'logichub-publish'
  };

  await putGitHubFile(
    githubRepo,
    registryPath,
    githubToken,
    `LogicHub Registry: indexed ${metadata.name}`,
    JSON.stringify(nextRegistry, null, 2),
    existing?.sha
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { appName, prdContext, internalPRD = '' } = req.body;

  if (!appName || !prdContext) {
    return res.status(400).json({ error: 'Missing appName or prdContext' });
  }

  const slug = createSlug(appName);

  try {
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const baseSystemInstruction = 'You are the Daxini LogicHub engine. The user will provide a Product Requirements Document (PRD). You must output a completely functional, single-file HTML application using Vanilla JS and CSS. DO NOT wrap the output in markdown code blocks like ```html. Output ONLY the raw HTML code, nothing else. It must have a dark mode aesthetic (#030508).';
    const dynamicInstruction = typeof internalPRD === 'string' ? internalPRD.trim() : '';
    const assembledSystemInstruction = dynamicInstruction
      ? `${baseSystemInstruction}\n\n# INTERNAL PRD MODIFIERS\n${dynamicInstruction}`
      : baseSystemInstruction;

    const geminiRes = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: assembledSystemInstruction }]
        },
        contents: [{
          parts: [{ text: prdContext }]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8000
        }
      })
    });

    const geminiData = await geminiRes.json();
    if (geminiData.error) {
      throw new Error('Gemini API Error: ' + geminiData.error.message);
    }

    let generatedHTML = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (generatedHTML.startsWith('```html')) {
      generatedHTML = generatedHTML.replace(/^```html\n?/, '').replace(/\n?```$/, '');
    } else if (generatedHTML.startsWith('```')) {
      generatedHTML = generatedHTML.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    const githubRepo = 'via-decide/daxini.space';
    const githubToken = process.env.GITHUB_TOKEN;
    const filePath = `apps/${slug}/index.html`;
    const tags = inferTags(appName, prdContext, internalPRD);
    const directUrl = `https://daxini.space/apps/${slug}/index.html`;
    const storeUrl = `https://daxini.space/?app=${slug}`;
    const metadata = {
      slug,
      name: appName,
      icon: inferIcon(tags),
      url: directUrl,
      status: 'live',
      desc: inferDescription(appName, prdContext),
      ownerType: 'community',
      tier: 'free',
      source: 'logichub',
      tags,
      createdAt: new Date().toISOString()
    };

    const existingPage = await getGitHubFile(githubRepo, filePath, githubToken);
    await putGitHubFile(
      githubRepo,
      filePath,
      githubToken,
      `LogicHub Auto-Forge: Created ${appName} via Gemini`,
      generatedHTML,
      existingPage?.sha
    );

    await putGitHubFile(
      githubRepo,
      `apps/${slug}/meta.json`,
      githubToken,
      `LogicHub Metadata: ${appName}`,
      JSON.stringify(metadata, null, 2)
    );

    await updateCommunityRegistry({ githubRepo, githubToken, metadata });

    return res.status(200).json({
      success: true,
      message: 'App synthesized and published to Daxini Space.',
      url: storeUrl,
      appUrl: directUrl,
      slug,
      tags
    });
  } catch (error) {
    console.error('Forge Error:', error);
    return res.status(500).json({ error: 'Synthesis Failed: ' + error.message });
  }
}
