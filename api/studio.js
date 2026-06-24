const STUDIO_TOKEN = process.env.STUDIO_TOKEN || 'Elephant9';
const BLOTATO_KEY = process.env.BLOTATO_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const BLOTATO_BASE = 'https://backend.blotato.com/v2';

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
  const { action } = body || {};

  try {
    // ââ GET ACCOUNTS ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
    if (action === 'get_accounts') {
      if (!BLOTATO_KEY) return res.status(200).json({ accounts: [], warning: 'BLOTATO_API_KEY not set' });
      try {
        const r = await fetch(`${BLOTATO_BASE}/users/me/accounts`, {
          headers: { 'blotato-api-key': BLOTATO_KEY }
        });
        const rawText = await r.text();
        console.log('Blotato status:', r.status, 'body:', rawText.slice(0, 500));
        if (!r.ok) return res.status(200).json({ accounts: [], warning: `Blotato error ${r.status}: ${rawText.slice(0,100)}` });
        const d = JSON.parse(rawText);
        const accounts = d.accounts || d.items || d.data || (Array.isArray(d) ? d : []);
        console.log('Parsed accounts:', accounts.length);
        return res.status(200).json({ accounts, warning: accounts.length === 0 ? 'Key valid but no accounts returned — keys: ' + Object.keys(d).join(',') : undefined });
      } catch (e) {
        console.log('Blotato fetch error:', e.message);
        return res.status(200).json({ accounts: [], warning: e.message });
      }
    }

    // ââ SCHEDULE POST âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
    if (action === 'schedule_post') {
      const { accountId, platform, text, hashtags } = body;
      if (!accountId || !platform || !text) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const fullText = text + (hashtags ? '\n\n' + hashtags : '');
      const target = { targetType: platform };
      if (platform === 'facebook' || platform === 'linkedin') target.pageId = accountId;
      const r = await fetch(`${BLOTATO_BASE}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'blotato-api-key': BLOTATO_KEY,
        },
        body: JSON.stringify({
          post: {
            accountId,
            content: { text: fullText, mediaUrls: [], platform },
            target,
          },
          useNextFreeSlot: true,
        }),
      });
      if (!r.ok) {
        const err = await r.text();
        throw new Error(err);
      }
      const d = await r.json();
      return res.status(200).json({ success: true, postSubmissionId: d.postSubmissionId });
    }

    // ── CRAWL WEBSITE ─────────────────────────────────────────────────────────
    if (action === 'crawl_website') {
      const { url } = body;
      if (!url) return res.status(400).json({ error: 'No URL provided' });
      if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: `Based on this website URL, infer the business details and return brand information as JSON.

URL: ${url}

Return ONLY a valid JSON object with these exact fields (no markdown, no backticks, no explanation):
{"name":"business name","industry":"sector","description":"one sentence what they do","voice":"tone and communication style","topics":["topic1","topic2","topic3","topic4","topic5"],"audience":"who their customers are"}`,
          }],
        }),
      });
      if (!r.ok) {
        const errBody = await r.text().catch(() => '');
        throw new Error(`AI error ${r.status}: ${errBody.slice(0, 200)}`);
      }
      const d = await r.json();
      const text = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('');

      let brand = null;
      try { brand = JSON.parse(text.trim()); } catch {}
      if (!brand) {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) try { brand = JSON.parse(m[0]); } catch {}
      }
      if (!brand) throw new Error(`Could not parse AI response: ${text.slice(0, 100)}`);
      return res.status(200).json({ brand });
    }

    // ── SEO / GEO / AEO REPORT ───────────────────────────────────────────────
    if (action === 'generate_seo_report') {
      const { url } = body;
      if (!url) return res.status(400).json({ error: 'No URL provided' });
      if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: `You are an expert in SEO, GEO (Generative Engine Optimisation) and AEO (Answer Engine Optimisation). Audit this website based on your knowledge of it and its industry.

URL: ${url}

Definitions:
- SEO: traditional search ranking (keywords, backlinks, technical, content quality)
- GEO: optimising to appear in AI-generated answers from ChatGPT, Perplexity, Google AI Overviews — needs clear factual claims, citations, structured content, topical authority
- AEO: optimising for featured snippets, People Also Ask, voice assistants — needs FAQ schema, direct answers, conversational content

Return ONLY valid JSON (no markdown, no backticks, no explanation):
{"overall_score":<0-100>,"seo":{"score":<0-100>,"summary":"<2 sentences>","wins":["<strength>","<strength>","<strength>"],"actions":["<fix>","<fix>","<fix>","<fix>"]},"geo":{"score":<0-100>,"summary":"<2 sentences>","wins":["<strength>","<strength>"],"actions":["<fix>","<fix>","<fix>"]},"aeo":{"score":<0-100>,"summary":"<2 sentences>","wins":["<strength>","<strength>"],"actions":["<fix>","<fix>","<fix>"]},"quick_wins":["<highest impact action>","<highest impact action>","<highest impact action>"]}

Be specific to this actual site and sector. Score honestly.`,
          }],
        }),
      });
      if (!r.ok) {
        const errBody = await r.text().catch(() => '');
        throw new Error(`AI error ${r.status}: ${errBody.slice(0, 200)}`);
      }
      const d = await r.json();
      const text = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
      let report = null;
      try { report = JSON.parse(text.trim()); } catch {}
      if (!report) { const m = text.match(/\{[\s\S]*\}/); if (m) try { report = JSON.parse(m[0]); } catch {} }
      if (!report) throw new Error(`Could not parse report: ${text.slice(0, 100)}`);
      return res.status(200).json({ report });
    }

    // ── SUGGEST TOPICS ────────────────────────────────────────────────────────
    if (action === 'suggest_topics') {
      const { client } = body;
      if (!client) return res.status(400).json({ error: 'No client provided' });
      if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: `You are a social media strategist. Suggest 5 specific content ideas for this business.

Business: ${client.name}
Industry: ${client.industry || ''}
Description: ${client.description || ''}
Audience: ${client.audience || ''}
Brand voice: ${client.voice || ''}
Key topics: ${(client.topics || []).join(', ')}

Return ONLY a JSON array of 5 short content steer strings (10-15 words each, punchy and specific, no quotes inside strings):
["idea 1","idea 2","idea 3","idea 4","idea 5"]`,
          }],
        }),
      });
      if (!r.ok) throw new Error('AI error: ' + r.status);
      const d = await r.json();
      const text = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
      let ideas = null;
      try { ideas = JSON.parse(text.trim()); } catch {}
      if (!ideas) { const m = text.match(/\[[\s\S]*\]/); if (m) try { ideas = JSON.parse(m[0]); } catch {} }
      if (!Array.isArray(ideas)) throw new Error('Could not parse ideas');
      return res.status(200).json({ ideas });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (e) {
    console.error('Studio API error:', e);
    return res.status(500).json({ error: e.message });
  }
};
