const STUDIO_TOKEN = process.env.STUDIO_TOKEN || 'Elephant9';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-studio-token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ââ AUTH CHECK ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const token = req.headers['x-studio-token'];
  if (!token || token !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { client, brief, postCount } = body || {};

  if (!client || !postCount) {
    return res.status(400).json({ error: 'Missing client or postCount' });
  }

  try {
    const platformList = (client.platforms || []).join(', ');
    const userMsg = brief
      ? `Create ${postCount} social media posts about: ${brief}. Platforms: ${platformList}.`
      : `Create ${postCount} varied social media posts for ${client.name} across ${platformList}.`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: `You are a social media content strategist for The Agentic Group, a UK AI consultancy.

CLIENT: ${client.name}
INDUSTRY: ${client.industry || ''}
DESCRIPTION: ${client.description || ''}
AUDIENCE: ${client.audience || ''}
BRAND VOICE: ${client.voice || 'Professional and approachable'}
KEY TOPICS: ${(client.topics || []).join(', ')}
PLATFORMS: ${platformList}

You MUST respond with ONLY a valid JSON object. No markdown. No backticks. No explanation. Start with { end with }.

Format:
{"posts":[{"platform":"linkedin","text":"full post text","hashtags":"#Tag1 #Tag2","hook":"opening hook","type":"text"}]}

Create platform-optimised content. LinkedIn: professional, longer form. Instagram: visual, punchy. Facebook: conversational. Twitter/X: concise, punchy under 280 chars. TikTok: hook-first, trend-aware. Distribute posts evenly across all platforms.`,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    if (!r.ok) throw new Error('AI error: ' + r.status);
    const d = await r.json();
    const rawText = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();

    let posts = null;
    try { const p = JSON.parse(rawText); if (Array.isArray(p.posts)) posts = p.posts; } catch {}
    if (!posts) {
      const m = rawText.match(/\{[\s\S]*\}/);
      if (m) try { const p = JSON.parse(m[0]); if (Array.isArray(p.posts)) posts = p.posts; } catch {}
    }
    if (!posts) {
      const stripped = rawText.replace(/```json|```/g, '').trim();
      try { const p = JSON.parse(stripped); if (Array.isArray(p.posts)) posts = p.posts; } catch {}
    }
    if (!posts || posts.length === 0) throw new Error('Could not parse response â please try again');

    return res.status(200).json({ posts });

  } catch (e) {
    console.error('Generate error:', e);
    return res.status(500).json({ error: e.message });
  }
};
