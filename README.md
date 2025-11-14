# 🤖 AI Trading Bot Dashboard

Real-time trading dashboard with live Bitcoin price charts and trade markers from your AI trading bot.

## Features

- 📊 **Real-time Price Charts** - Live Bitcoin/USD candlestick charts updating every second
- 📍 **Trade Markers** - Visual markers showing bot's entry/exit points on the chart
- 💰 **Live P&L Tracking** - Real-time profit/loss for open positions
- 📈 **Performance Metrics** - Win rate, total trades, best trades, and more
- 📱 **Responsive Design** - Works on desktop and mobile devices
- 🎨 **TradingView Style** - Professional dark theme interface

## Setup Instructions

### 1. Environment Variables

Create a `.env` file with your configuration:

```bash
# Finnhub API Key (use your second key)
FINNHUB_API_KEY=your_finnhub_api_key_2

# Supabase Configuration (same as trading bot)
SUPABASE_URL=your_trades_supabase_url
SUPABASE_KEY=your_trades_supabase_key

# Server Configuration
PORT=3000
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run the Dashboard

```bash
# Development mode
npm run dev

# Production mode
npm start
```

### 4. Access Dashboard

Open your browser and go to:
- Local: `http://localhost:3000`
- Railway: `https://your-app.railway.app`

## API Endpoints

- `GET /api/trades` - Get recent trades from Supabase
- `GET /api/current-position` - Get current open position
- `GET /api/stats` - Get trading statistics
- `GET /api/candles` - Get candlestick data

## WebSocket Connection

The dashboard connects to WebSocket on port 8080 for real-time price updates from Finnhub.

## Architecture

```
Dashboard Server
├── Express.js Backend (Port 3000)
├── WebSocket Server (Port 8080)
├── Finnhub WebSocket Client
├── Supabase Client
└── Static Frontend (HTML/CSS/JS)
```

## Deployment to Railway

1. Connect this repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically

## Trading Bot Integration

This dashboard reads data from your trading bot's Supabase database:
- Table: `paper_trades`
- Real-time position tracking
- Historical trade analysis
- Performance metrics

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile browsers

## Troubleshooting

1. **No price updates**: Check Finnhub API key and WebSocket connection
2. **No trades showing**: Verify Supabase URL and key
3. **Chart not loading**: Ensure Chart.js is loaded properly
4. **WebSocket errors**: Check if port 8080 is available

## Future Enhancements

- [ ] TradingView Charting Library integration
- [ ] Advanced technical indicators
- [ ] Trade alerts and notifications
- [ ] Multiple timeframe analysis
- [ ] Export trade history
- [ ] Mobile app version
