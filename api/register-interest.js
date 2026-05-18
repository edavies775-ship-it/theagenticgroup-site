export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { firstName, lastName, email, phone, companyName, properties, region, platforms, source, tags } = req.body;

  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const response = await fetch('https://services.leadconnectorhq.com/contacts/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      },
      body: JSON.stringify({
        locationId: 'Qpoz379HAyQuaCJRwhKk',
        firstName,
        lastName,
        email,
        phone,
        companyName,
        source,
        tags,
        customFields: [
          { key: 'properties', field_value: properties },
          { key: 'region', field_value: region },
          { key: 'platforms', field_value: platforms }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('GHL error:', data);
      return res.status(response.status).json({ error: data.message || 'GHL API error' });
    }

    return res.status(200).json({ success: true, contactId: data.contact?.id });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
