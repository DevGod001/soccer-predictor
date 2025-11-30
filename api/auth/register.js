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
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Validate PIN (should be 4-6 digits)
    if (!/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be 4-6 digits' });
    }
    
    const emailLower = email.toLowerCase();
    const userKey = `user:${emailLower}:${pin}`;
    
    // Check if user already exists
    const existingUser = await kv.get(userKey);
    if (existingUser) {
      return res.status(200).json({
        success: true,
        message: 'Account already exists',
        user: {
          email: emailLower,
          isVip: existingUser.isVip || false,
          predictionsToday: existingUser.predictionsToday || 0
        }
      });
    }
    
    // Create new user record
    const user = {
      email: emailLower,
      pin: pin,
      isVip: false,
      vipUntil: null,
      predictionsToday: 0,
      lastPredictionDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      transactions: []
    };
    
    // Save user to Redis
    await kv.set(userKey, user);
    
    // Also add to users list for admin panel
    await kv.sadd('users:all', userKey);
    
    res.status(200).json({
      success: true,
      message: 'Account created successfully',
      user: {
        email: user.email,
        isVip: user.isVip,
        predictionsToday: user.predictionsToday
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', message: error.message });
  }
}
