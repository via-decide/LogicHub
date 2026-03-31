// /api/publish.js (Vercel Serverless Function)

export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { appName, prdContext } = req.body;

  if (!appName || !prdContext) {
    return res.status(400).json({ error: 'Missing appName or prdContext' });
  }

  // Create a URL-safe slug (e.g., "Neon Snake" -> "neon-snake-987123")
  const slug = appName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 100000);

  try {
    // -----------------------------------------------------------------
    // PHASE 1: CALL ANTHROPIC TO GENERATE THE CODE
    // -----------------------------------------------------------------
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307', // Fast and cheap for generation
        max_tokens: 4000,
        system: "You are the Daxini LogicHub engine. The user will provide a Product Requirements Document (PRD). You must output a completely functional, single-file HTML application using Vanilla JS and CSS. DO NOT wrap the output in markdown code blocks like ```html. Output ONLY the raw HTML code, nothing else. It must have a dark mode aesthetic (#030508).",
        messages: [{ role: 'user', content: prdContext }]
      })
    });

    const anthropicData = await anthropicRes.json();
    
    if (anthropicData.error) {
      throw new Error('Anthropic API Error: ' + anthropicData.error.message);
    }

    const generatedHTML = anthropicData.content[0].text.trim();

    // -----------------------------------------------------------------
    // PHASE 2: COMMIT DIRECTLY TO DAXINI.SPACE GITHUB REPO
    // -----------------------------------------------------------------
    // GitHub API requires file content to be Base64 encoded
    const base64Content = Buffer.from(generatedHTML).toString('base64');
    
    const githubRepo = 'via-decide/daxini.space'; // Your target repo
    const filePath = `apps/${slug}/index.html`; // Saves to an "apps" folder

    const githubRes = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${filePath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        message: `LogicHub Auto-Forge: Created ${appName}`,
        content: base64Content,
        branch: 'main' // Ensure this matches your default branch
      })
    });

    const githubData = await githubRes.json();

    if (githubData.message && githubData.message.includes('Bad credentials')) {
        throw new Error('GitHub Token is invalid or expired.');
    }

    // -----------------------------------------------------------------
    // PHASE 3: RETURN THE GOLDEN URL
    // -----------------------------------------------------------------
    // The Vercel deploy takes ~10 seconds, but we give the user the URL instantly
    const liveUrl = `https://daxini.space/apps/${slug}/index.html`;

    return res.status(200).json({ 
      success: true, 
      message: 'App Synthesized and Published to Daxini Space.',
      url: liveUrl,
      slug: slug
    });

  } catch (error) {
    console.error('Forge Error:', error);
    return res.status(500).json({ error: 'Synthesis Failed: ' + error.message });
  }
}
