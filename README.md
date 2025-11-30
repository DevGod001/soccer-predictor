# Soccer Predictor with VIP Subscription System

A full-featured soccer match prediction application with email+PIN authentication, daily prediction limits, and Bitcoin payment integration for VIP subscriptions.

## 🌟 Features

### Free Tier

- **3 predictions per day**
- Basic match analysis
- Team statistics
- Major European leagues (Premier League, La Liga, Serie A, Bundesliga, Ligue 1)

### VIP Tier ($15/month)

- **20 predictions per day**
- Advanced match analysis
- All features included
- Priority support
- Ad-free experience

## 📋 System Architecture

### Authentication

- **Email + PIN** authentication (no passwords)
- Users create a 4-6 digit PIN
- Credentials stored in localStorage (demo) or backend database (production)
- Auto-login on return visits

### Payment System

- **Bitcoin payments** via Coinbase Commerce
- $15/month VIP subscription
- Manual verification by admin

### Admin Panel

- Located at `/management.html`
- Default password: `SoccerAdmin2025!` (change this!)
- View all users, transactions, and activities
- Manually upgrade users to VIP
- Track daily predictions

## 🚀 Setup Instructions

### 1. Prerequisites

- Node.js installed
- Vercel account (for deployment)
- Football-Data.org API key
- Coinbase Commerce account (for Bitcoin payments)

### 2. Get API Keys

#### Football-Data.org API

1. Go to https://www.football-data.org/
2. Register for a free account
3. Get your API key from the dashboard

#### Coinbase Commerce (Optional - for Bitcoin payments)

1. Go to https://commerce.coinbase.com/
2. Sign up for an account
3. Create a charge for $15
4. Get the charge URL

### 3. Environment Variables

Create a `.env.local` file in your project root:

```bash
# Football Data API Key
FOOTBALL_API_KEY=your_football_data_api_key_here

# For production with a real database, add:
# USERS_DATA={} # JSON string of user data
# Or use Vercel KV, Supabase, Firebase, etc.
```

### 4. Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Add environment variables in Vercel Dashboard
# Go to: Project Settings > Environment Variables
# Add FOOTBALL_API_KEY with your API key
```

### 5. Configure Coinbase Commerce

In `vip.html`, update the payment function:

```javascript
// Replace this line in initiateBitcoinPayment():
alert(`Payment Integration...`);

// With:
window.location.href = "YOUR_COINBASE_COMMERCE_CHARGE_URL";
```

### 6. Change Admin Password

In `management.html`, change the default admin password:

```javascript
// Line 258
const adminPass = "SoccerAdmin2025!"; // Change this to your secure password
```

## 📁 File Structure

```
soccer-predictor/
├── index.html              # Main prediction page
├── vip.html               # VIP subscription page
├── management.html        # Admin panel
├── api/
│   ├── auth/
│   │   ├── login.js      # User login
│   │   └── register.js   # User registration
│   ├── predictions/
│   │   └── track.js      # Track daily limits
│   ├── competitions/
│   │   └── all.js        # Get all competitions
│   │   └── [competitionId]/
│   │       └── teams.js  # Get teams by competition
│   └── teams/
│       └── [teamId]/
│           ├── index.js   # Get team details
│           └── matches.js # Get team matches
└── README.md
```

## 🎯 Usage

### For Users

1. **Visit the site** - You'll see a login modal
2. **Enter email and PIN** - Create a new account or login
3. **Start predicting** - Type team names and get predictions
4. **Track your usage** - See predictions remaining in the header
5. **Upgrade to VIP** - Click "Upgrade to VIP" button

### For Admins

1. **Visit /management.html**
2. **Login with admin password**
3. **View dashboard** - See all users and transactions
4. **Manual upgrades** - Upgrade users to VIP manually
5. **Monitor activity** - Track prediction usage

## 🔧 Current Implementation Status

### ✅ Completed

- Email + PIN authentication system
- Daily prediction limits (3 free, 20 VIP)
- localStorage-based user tracking (for demo)
- VIP subscription page with Bitcoin payment UI
- Admin management panel
- Coinbase Commerce integration (ready to connect)
- Responsive design
- Real API integration with Football-Data.org

### ⚠️ Production Requirements

To use in production, you need to:

1. **Add a Database**

   - Replace localStorage with a real database
   - Options: Vercel KV, Supabase, Firebase, MongoDB Atlas
   - Store: users, transactions, prediction counts

2. **Implement Real API Endpoints**

   - Update `/api/auth/login.js` to query database
   - Update `/api/auth/register.js` to save to database
   - Update `/api/predictions/track.js` to use database

3. **Connect Coinbase Commerce**

   - Set up webhooks to receive payment notifications
   - Auto-upgrade users after successful payment
   - Track transactions in database

4. **Security Enhancements**
   - Add rate limiting
   - Implement proper session management
   - Hash/encrypt PINs
   - Add CSRF protection
   - Use environment variables for sensitive data

## 💡 Upgrading to Production Database

### Example: Using Vercel KV

```javascript
// Install Vercel KV
npm install @vercel/kv

// In your API routes:
import { kv } from '@vercel/kv';

// Save user
await kv.set(`user:${email}:${pin}`, userData);

// Get user
const user = await kv.get(`user:${email}:${pin}`);

// Increment predictions
await kv.incr(`predictions:${email}:${today}`);
```

### Example: Using Supabase

```javascript
// Install Supabase
npm install @supabase/supabase-js

// Initialize client
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Save user
await supabase.from('users').insert({ email, pin, isVip: false });

// Get user
const { data } = await supabase.from('users').select('*').eq('email', email).eq('pin', pin);
```

## 🔒 Security Best Practices

1. **Never expose API keys** - Use environment variables
2. **Change default admin password** - Use strong password
3. **Implement rate limiting** - Prevent abuse
4. **Use HTTPS** - Always use secure connections
5. **Validate all inputs** - Sanitize user data
6. **Regular backups** - Backup user data regularly

## 📊 API Rate Limits

**Football-Data.org Free Tier:**

- 10 calls per minute
- ~14,400 requests per day
- Covers 12 major competitions

**Your App Limits:**

- Free users: 3 predictions/day
- VIP users: 20 predictions/day
- Each prediction uses 2-3 API calls

## 🐛 Troubleshooting

### Teams not loading

- Check your FOOTBALL_API_KEY environment variable
- Verify API key is valid at football-data.org
- Check browser console for errors

### Predictions not working

- Ensure you're logged in
- Check daily limit hasn't been reached
- Verify teams are in the database

### Admin panel not accessible

- Check you're using correct password
- Clear browser cache
- Try incognito mode

## 📞 Support

For issues or questions:

1. Check this README first
2. Review browser console for errors
3. Check Vercel deployment logs
4. Contact admin at your-email@example.com

## 📝 License

This project is for demonstration purposes. Modify as needed for production use.

---

**Important:** This is a demo implementation using localStorage. For production, implement a proper database and security measures as outlined above.
