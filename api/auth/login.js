import { createClient } from '@vercel/kv';

// Use custom STORAGE prefix environment variables
const kv = createClient({
  url: process.env.STORAGE_REST_API_URL,
  token: process.env.STORAGE_REST_API_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { email, pin } = req.body;
    
    if (!email || !pin) {
      return res.status(400).json({ error: 'Email and PIN are required' });
    }
    
    const emailLower = email.toLowerCase();
    const userKey = `user:${emailLower}:${pin}`;
    
    // Get user from Redis
    const user = await kv.get(userKey);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or PIN' });
    }
    
    // Check if subscription is expired
    if (user.vipUntil && new Date(user.vipUntil) < new Date()) {
      user.isVip = false;
      await kv.set(userKey, user);
    }
    
    // Reset predictions counter if it's a new day
    const today = new Date().toISOString().split('T')[0];
    if (user.lastPredictionDate !== today) {
      user.predictionsToday = 0;
      user.lastPredictionDate = today;
      await kv.set(userKey, user);
    }
    
    res.status(200).json({
      success: true,
      user: {
        email: user.email,
        isVip: user.isVip || false,
        vipUntil: user.vipUntil || null,
        predictionsToday: user.predictionsToday || 0,
        lastPredictionDate: user.lastPredictionDate || null
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', message: error.message });
  }
}
