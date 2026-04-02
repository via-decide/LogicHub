// /api/auth.js — LogicHub GitHub OAuth Exchange
//
// Flow:
//   1. Receive { code } from frontend
//   2. Exchange code for access_token with GitHub
//   3. Use token to get user info (username, avatar)
//   4. Return user info to frontend
//
// Required env vars:
//   GITHUB_CLIENT_ID
//   GITHUB_CLIENT_SECRET

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'OAuth code missing' });

  const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
  const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).json({ error: 'GitHub OAuth credentials not configured on server' });
  }

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      throw new Error(`GitHub Token Error: ${tokenData.error_description || tokenData.error}`);
    }

    const accessToken = tokenData.access_token;

    // 2. Get user profile
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    const userData = await userRes.json();

    if (!userRes.ok) {
      throw new Error(`GitHub User Error: ${userData.message || 'Unknown'}`);
    }

    // 3. Return relevant data
    return res.status(200).json({
      username: userData.login,
      avatar: userData.avatar_url,
      name: userData.name,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
