export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'No message provided' });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: `Rwyt ti\'n gynorthwyydd AI Cymraeg sy\'n cynrychioli The Agentic Group — cwmni ymgynghori AI o Orllewin Cymru.
Ateb bob amser yn Gymraeg yn unig, mewn arddull gynnes, hyderus a phroffesiynol.
Cadw atebion yn gryno — un neu ddau baragraff ar y mwyaf — gan fod y sgwrs hon yn llafar.
Mae The Agentic Group yn helpu busnesau bach a chanolig y DU i ddefnyddio systemau AI ymreolaethol i arbed amser ac arian.
Os gofynnir cwestiwn am brisiau, anfonwch nhw i theagenticgroup.co.uk i gael asesiad am ddim.`,
      messages: [{ role: 'user', content: message }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return res.status(500).json({ error: 'Claude API error', detail: err });
  }

  const data = await response.json();
  res.status(200).json({ reply: data.content[0].text });
}
