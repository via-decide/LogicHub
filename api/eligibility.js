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
  } else {
    // For Global: SaaS Subscriptions + Global Founder
    response.models = ['RAZORPAY_SAAS', 'GLOBAL_LIFETIME'];
    response.currency = 'USD';
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
