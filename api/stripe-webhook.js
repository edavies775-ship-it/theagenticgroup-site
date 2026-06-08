const crypto = require('crypto');

async function getRawBody(req) {
  return new Promise(function(resolve, reject) {
    var chunks = [];
    req.on('data', function(chunk) { chunks.push(Buffer.from(chunk)); });
    req.on('end', function() { resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });
}

function verifySignature(rawBody, sigHeader, secret) {
  var parts = sigHeader.split(',');
  var timestamp;
  var signatures = [];
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].trim();
    if (part.startsWith('t=')) timestamp = part.slice(2);
    if (part.startsWith('v1=')) signatures.push(part.slice(3));
  }
  if (!timestamp || !signatures.length) return false;

  var age = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
  if (age > 300) return false;

  var payload = timestamp + '.' + rawBody;
  var expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  return signatures.some(function(sig) {
    try {
      return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
    } catch (e) {
      return false;
    }
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  var rawBody = await getRawBody(req);
  var sigHeader = req.headers['stripe-signature'];

  if (!sigHeader || !verifySignature(rawBody.toString('utf8'), sigHeader, process.env.STRIPE_WEBHOOK_SECRET)) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  var event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  if (event.type === 'checkout.session.completed') {
    var session = event.data.object;
    var email = (session.customer_details && session.customer_details.email) || session.customer_email;
    var tier = session.metadata && session.metadata.tier;
    var audience = session.metadata && session.metadata.audience;

    if (email) {
      var tags = ['staygentic-clean-paid', 'founding-partner'];
      if (tier) tags.push('tier-' + tier);
      tags.push(audience === 'commercial' ? 'commercial-cleaning' : 'holiday-let');

      try {
        await fetch('https://services.leadconnectorhq.com/contacts/', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + process.env.GHL_API_KEY,
            'Content-Type': 'application/json',
            'Version': '2021-07-28',
          },
          body: JSON.stringify({
            locationId: 'Qpoz379HAyQuaCJRwhKk',
            email: email,
            source: 'staygentic-clean-payment',
            tags: tags,
            customFields: [
              { key: 'tier', field_value: tier },
              { key: 'audience', field_value: audience },
            ],
          }),
        });
      } catch (err) {
        console.error('GHL error:', err);
      }
    }
  }

  return res.status(200).json({ received: true });
};
