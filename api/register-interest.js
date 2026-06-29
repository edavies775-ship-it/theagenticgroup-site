export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { firstName, lastName, email, phone, companyName, properties, region, platforms, source, tags } = req.body;

  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Only include custom fields that have actual values
  const customFields = [];
  if (properties) customFields.push({ key: 'properties', field_value: properties });
  if (region) customFields.push({ key: 'region', field_value: region });
  if (platforms) customFields.push({ key: 'platforms', field_value: platforms });

  const payload = {
    locationId: 'Qpoz379HAyQuaCJRwhKk',
    firstName,
    lastName,
    email,
    companyName,
    source,
    tags,
    ...(phone && { phone }),
    ...(customFields.length > 0 && { customFields })
  };

  try {
    const response = await fetch('https://services.leadconnectorhq.com/contacts/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      const ghlError = data.message || data.error || JSON.stringify(data);
      console.error('GHL error:', ghlError);
      return res.status(response.status).json({ error: ghlError });
    }

    return res.status(200).json({ success: true, contactId: data.contact?.id });
  } catch (err) {
    console.error('Server error:', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
}
