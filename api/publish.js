// /api/publish.js (Vercel Serverless Function - GEMINI ENGINE)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { appName, prdContext, internalPRD = '' } = req.body;

  if (!appName || !prdContext) {
    return res.status(400).json({ error: 'Missing appName or prdContext' });
  }

  // Create a URL-safe slug (e.g., "Neon Snake" -> "neon-snake-987123")
  const slug = appName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 100000);

  try {
    // -----------------------------------------------------------------
    // PHASE 1: CALL GEMINI API TO GENERATE THE CODE
    // -----------------------------------------------------------------
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const baseSystemInstruction = "You are the Daxini LogicHub engine. The user will provide a Product Requirements Document (PRD). You must output a completely functional, single-file HTML application using Vanilla JS and CSS. DO NOT wrap the output in markdown code blocks like ```html. Output ONLY the raw HTML code, nothing else. It must have a dark mode aesthetic (#030508).";
    const dynamicInstruction = typeof internalPRD === 'string' ? internalPRD.trim() : '';
    const assembledSystemInstruction = dynamicInstruction
      ? `${baseSystemInstruction}\n\n# INTERNAL PRD MODIFIERS\n${dynamicInstruction}`
      : baseSystemInstruction;

    const geminiRes = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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

    let generatedHTML = geminiData.candidates[0].content.parts[0].text.trim();
    
    // Safety cleanup just in case Gemini wraps it in ```html ... ```
    if (generatedHTML.startsWith('```html')) {
        generatedHTML = generatedHTML.replace(/^```html\n?/, '').replace(/\n?```$/, '');
    } else if (generatedHTML.startsWith('```')) {
        generatedHTML = generatedHTML.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    // -----------------------------------------------------------------
    // PHASE 2: COMMIT DIRECTLY TO DAXINI.SPACE GITHUB REPO
    // -----------------------------------------------------------------
    const base64Content = Buffer.from(generatedHTML).toString('base64');
    const githubRepo = 'via-decide/daxini.space'; // Your target repo
    const filePath = `apps/${slug}/index.html`;

    const githubRes = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${filePath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        message: `LogicHub Auto-Forge: Created ${appName} via Gemini`,
        content: base64Content,
        branch: 'main'
      })
    });

    const githubData = await githubRes.json();

    if (githubData.message && githubData.message.includes('Bad credentials')) {
        throw new Error('GitHub Token is invalid or expired.');
    }

    // -----------------------------------------------------------------
    // PHASE 3: RETURN THE GOLDEN URL
    // -----------------------------------------------------------------
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
