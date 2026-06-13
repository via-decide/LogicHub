export default function handler(req, res) {
  // Extract country from Cloudflare/Vercel headers
  const country = req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || 'US';
  const ip = req.headers['x-forwarded-for'] || '127.0.0.1';

  // Base response structure
  const response = {
    client_ip: ip,
    client_country: country,
    models: []
  };

  if (country === 'IN') {
    // For India: Strictly UPI + Lifetime passes. No cloud SaaS.
    response.models = ['UPI_LIFETIME_ONLY'];
    response.currency = 'INR';
    response.tiers = [
      {
        id: 'founder_pass_in',
        name: 'Lifetime Founder Pass',
        price: '₹1717',
        interval: 'lifetime',
        features: ['100% Offline Capable', 'Zayvora + LogicHub Access', 'UPI Enabled']
      }
    ];
  } else {
    // For Global: SaaS Subscriptions
    response.models = ['STRIPE_SAAS'];
    response.currency = 'USD';
    response.tiers = [
      {
        id: 'builder_saas_global',
        name: 'Builder SaaS (LogicHub)',
        price: '$29',
        interval: 'month',
        features: ['LogicHub Cloud Access', 'Unlimited Exports', 'Email Support']
      },
      {
        id: 'pro_saas_global',
        name: 'Pro SaaS (Zayvora)',
        price: '$20',
        interval: 'month',
        features: ['Zayvora Cloud Agent', 'Unlimited Repo Intel', 'Priority Support']
      }
    ];
  }

  // Handle CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  res.status(200).json(response);
}
