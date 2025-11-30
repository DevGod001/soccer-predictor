import { createClient } from '@vercel/kv';

// Use custom STORAGE prefix environment variables
const kv = createClient({
  url: process.env.STORAGE_REST_API_URL,
  token: process.env.STORAGE_REST_API_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // GET: Fetch all users
    if (req.method === 'GET') {
      // Get all user keys
      const userKeys = await kv.smembers('users:all');
      
      if (!userKeys || userKeys.length === 0) {
        return res.status(200).json({
          users: [],
          stats: {
            totalUsers: 0,
            vipUsers: 0,
            totalRevenue: 0,
            todayPredictions: 0
          }
        });
      }
      
      // Fetch all users
      const users = await Promise.all(
        userKeys.map(async (key) => {
          const user = await kv.get(key);
          return user;
        })
      );
      
      // Calculate stats
      const vipUsers = users.filter(u => u && u.isVip).length;
      const totalRevenue = vipUsers * 15; // $15 per VIP user
      const today = new Date().toISOString().split('T')[0];
      const todayPredictions = await kv.get(`stats:predictions:${today}`) || 0;
      
      return res.status(200).json({
        users: users.filter(u => u !== null),
        stats: {
          totalUsers: users.length,
          vipUsers,
          totalRevenue,
          todayPredictions
        }
      });
    }
    
    // POST: Upgrade user to VIP
    if (req.method === 'POST') {
      const { email, pin, duration } = req.body;
      
      if (!email || !pin || !duration) {
        return res.status(400).json({ error: 'Email, PIN, and duration are required' });
      }
      
      const emailLower = email.toLowerCase();
      const userKey = `user:${emailLower}:${pin}`;
      
      // Get user
      const user = await kv.get(userKey);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Update user to VIP
      const vipUntil = new Date();
      vipUntil.setMonth(vipUntil.getMonth() + parseInt(duration));
      
      user.isVip = true;
      user.vipUntil = vipUntil.toISOString();
      
      // Save updated user
      await kv.set(userKey, user);
      
      return res.status(200).json({
        success: true,
        message: `User upgraded to VIP until ${vipUntil.toLocaleDateString()}`,
        user: {
          email: user.email,
          isVip: user.isVip,
          vipUntil: user.vipUntil
        }
      });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Admin API error:', error);
    res.status(500).json({ error: 'Admin API failed', message: error.message });
  }
}
