// LogicHub/api/checkout.js
// Next.js / Vercel Serverless Function for Razorpay Integration
import Razorpay from 'razorpay';

export default async function handler(req, res) {
  // CORS Handling
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { package_id, email, credits } = req.body;

  // Validate geofence context
  const country = req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || 'US';
  
  const ALLOWED_COUNTRIES = ['IN', 'LU', 'JP'];
  if (!ALLOWED_COUNTRIES.includes(country)) {
    return res.status(403).json({ error: 'This product is currently available only in India, Luxembourg, and Japan.' });
  }

  const isIndia = country === 'IN';

  // Security: Prevent global SaaS bypass from Indian IPs
  if (isIndia && package_id.startsWith('saas_')) {
    return res.status(403).json({ error: 'SaaS subscriptions are restricted in your region. Please purchase a Local-First Founder Pass via UPI.' });
  }

  try {
    // Initialize Razorpay
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || 'rzp_live_T3BiCiW0o4slky',
      key_secret: process.env.RAZORPAY_KEY_SECRET || ''
    });

    // 1. GLOBAL SAAS SUBSCRIPTIONS (Non-India)
    if (!isIndia && package_id.startsWith('saas_')) {
      let planId;
      if (package_id === 'saas_pro') planId = 'plan_ProSaaS20USD';
      if (package_id === 'saas_builder') planId = 'plan_BuilderSaaS29USD';
      
      const subscription = await razorpay.subscriptions.create({
        plan_id: planId,
        customer_notify: 1,
        total_count: 12
      });
      return res.status(200).json({ checkout_url: subscription.short_url });
    }

    // 2. INDIAN FOUNDER PASSES / ZAYVORA CREDITS (UPI)
    if (isIndia || package_id === 'founder') {
      let amount = 0;
      if (package_id === 'founder') amount = 171700; // ₹1717 in paise
      else if (package_id === 'starter') amount = 9900;
      else if (package_id === 'pro') amount = 79900;
      else if (package_id === 'enterprise') amount = 499900;
      else amount = 10000; // Fallback

      const order = await razorpay.orders.create({
        amount: amount,
        currency: 'INR',
        receipt: `receipt_${Date.now()}`
      });
      return res.status(200).json({ order_id: order.id });
    }

    return res.status(400).json({ error: 'Invalid package selected' });

  } catch (error) {
    console.error('Razorpay Error:', error);
    return res.status(500).json({ error: 'Payment gateway initialization failed.' });
  }
}
