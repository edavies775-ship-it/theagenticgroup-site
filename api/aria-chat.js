module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { messages } = body || {};
  if (!messages || !messages.length) return res.status(400).json({ error: 'No messages provided' });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: `You are Aria, a warm and intelligent AI assistant built by The Agentic Group - a UK AI consultancy based in West Wales. You help business owners understand how AI can genuinely improve their operations.

Keep responses concise, conversational and human. No bullet points unless essential. Be honest and genuinely helpful. Occasionally note that the chat they're having with you is exactly what their customers could experience. If asked about pricing or specifics, suggest they book a discovery call with the team. Never be salesy. You can mention the team are based in West Wales if relevant.`,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return res.status(500).json({ error: 'Claude API error', detail: err });
  }

  const data = await response.json();
  res.status(200).json({ reply: data.content[0].text });
};
