# 🚀 Deploy Trading Dashboard to Render

## Quick Deploy Steps:

### 1. **Go to Render Dashboard**
```
https://render.com/
```

### 2. **Connect GitHub Repository**
- Click "New +" → "Web Service"
- Connect GitHub account
- Select repository: `dashboardtrade/dashboard`
- Branch: `main`

### 3. **Configure Service**
```
Name: trading-dashboard
Environment: Node
Build Command: npm install
Start Command: node server.js
```

### 4. **Set Environment Variables**
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
FINNHUB_API_KEY=your_finnhub_api_key
NODE_ENV=production
```

### 5. **Deploy**
- Click "Create Web Service"
- Wait for deployment (2-3 minutes)
- Get your dashboard URL: `https://trading-dashboard-xxxx.onrender.com`

## 🔑 Required API Keys:

1. **Supabase** (for trade data)
   - URL: From your Supabase project settings
   - Key: Anon/public key from API settings

2. **Finnhub** (for price data)
   - Get free API key: https://finnhub.io/
   - 60 calls/minute on free tier

## ✅ Features Included:

- 📊 Real-time BTC price chart
- 📍 Automatic trade markers from Supabase
- 🎯 TradingView-style entry/exit points
- 📈 Live performance metrics
- 🔄 Auto-refresh every 30 seconds

## 🔗 Separate from Gemini Server

This dashboard is completely independent from your Gemini trading bot server. It only reads data from Supabase and displays it.
