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
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // Reset counter if it's a new day
    if (user.lastPredictionDate !== today) {
      user.predictionsToday = 0;
      user.lastPredictionDate = today;
    }
    
    // Check limits
    const maxPredictions = user.isVip ? 20 : 3;
    if (user.predictionsToday >= maxPredictions) {
      return res.status(429).json({
        error: 'Daily limit reached',
        limit: maxPredictions,
        used: user.predictionsToday,
        isVip: user.isVip
      });
    }
    
    // Increment counter
    user.predictionsToday += 1;
    
    // Save updated user data to Redis
    await kv.set(userKey, user);
    
    // Track prediction globally
    await kv.incr('stats:predictions:total');
    await kv.incr(`stats:predictions:${today}`);
    
    res.status(200).json({
      success: true,
      predictionsToday: user.predictionsToday,
      maxPredictions: maxPredictions,
      remaining: maxPredictions - user.predictionsToday,
      isVip: user.isVip
    });
    
  } catch (error) {
    console.error('Track prediction error:', error);
    res.status(500).json({ error: 'Failed to track prediction', message: error.message });
  }
}
