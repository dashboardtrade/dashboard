const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Supabase client for trades data
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Finnhub API configuration
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB_WS_URL = `wss://ws.finnhub.io?token=${FINNHUB_API_KEY}`;

// Store for real-time data
let currentPrice = 0;
let priceHistory = [];
let connectedClients = new Set();

// WebSocket server for client connections
const wss = new WebSocket.Server({ port: 8080 });

// Finnhub WebSocket connection
let finnhubWs;

function connectToFinnhub() {
  finnhubWs = new WebSocket(FINNHUB_WS_URL);
  
  finnhubWs.on('open', () => {
    console.log('🔗 Connected to Finnhub WebSocket');
    // Subscribe to Bitcoin real-time prices
    finnhubWs.send(JSON.stringify({
      'type': 'subscribe',
      'symbol': 'BINANCE:BTCUSDT'
    }));
  });
  
  finnhubWs.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      if (message.type === 'trade' && message.data) {
        message.data.forEach(trade => {
          currentPrice = trade.p;
          const priceData = {
            price: trade.p,
            volume: trade.v,
            timestamp: trade.t
          };
          
          // Store price history for candlestick formation
          priceHistory.push(priceData);
          
          // Keep only last 1000 price points
          if (priceHistory.length > 1000) {
            priceHistory.shift();
          }
          
          // Broadcast to all connected clients
          broadcastToClients({
            type: 'price_update',
            data: priceData
          });
        });
      }
    } catch (error) {
      console.error('Error parsing Finnhub message:', error);
    }
  });
  
  finnhubWs.on('close', () => {
    console.log('❌ Finnhub WebSocket closed, reconnecting...');
    setTimeout(connectToFinnhub, 5000);
  });
  
  finnhubWs.on('error', (error) => {
    console.error('Finnhub WebSocket error:', error);
  });
}

// Client WebSocket connections
wss.on('connection', (ws) => {
  console.log('📱 Client connected');
  connectedClients.add(ws);
  
  // Send current price to new client
  if (currentPrice > 0) {
    ws.send(JSON.stringify({
      type: 'price_update',
      data: { price: currentPrice, timestamp: Date.now() }
    }));
  }
  
  ws.on('close', () => {
    console.log('📱 Client disconnected');
    connectedClients.delete(ws);
  });
});

function broadcastToClients(message) {
  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// API Routes
app.get('/api/trades', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('paper_trades')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);
    
    if (error) throw error;
    
    res.json({ trades: data });
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

app.get('/api/current-position', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('paper_trades')
      .select('*')
      .eq('status', 'open')
      .order('timestamp', { ascending: false })
      .limit(1);
    
    if (error) throw error;
    
    res.json({ position: data[0] || null });
  } catch (error) {
    console.error('Error fetching current position:', error);
    res.status(500).json({ error: 'Failed to fetch current position' });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('paper_trades')
      .select('*')
      .eq('status', 'closed');
    
    if (error) throw error;
    
    const totalTrades = data.length;
    const winningTrades = data.filter(trade => trade.pnl > 0).length;
    const totalPnL = data.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades * 100) : 0;
    
    res.json({
      totalTrades,
      winningTrades,
      winRate: winRate.toFixed(1),
      totalPnL: totalPnL.toFixed(2),
      currentPrice
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// New endpoint for chart trade markers
app.get('/api/chart-trades', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('paper_trades')
      .select('trade_id, timestamp, direction, entry_price, exit_price, exit_time, status, pnl, trade_result')
      .eq('status', 'closed')
      .order('timestamp', { ascending: true })
      .limit(200);
    
    if (error) throw error;
    
    // Format trades for chart markers
    const chartTrades = data.map(trade => ({
      id: trade.trade_id,
      entryTime: new Date(trade.timestamp).getTime(),
      exitTime: trade.exit_time ? new Date(trade.exit_time).getTime() : null,
      direction: trade.direction,
      entryPrice: parseFloat(trade.entry_price),
      exitPrice: trade.exit_price ? parseFloat(trade.exit_price) : null,
      pnl: parseFloat(trade.pnl || 0),
      result: trade.trade_result
    }));
    
    res.json(chartTrades);
  } catch (error) {
    console.error('Error fetching chart trades:', error);
    res.status(500).json({ error: 'Failed to fetch chart trades' });
  }
});

app.get('/api/candles', async (req, res) => {
  try {
    // Generate 1-minute candles from price history
    const candles = generateCandles(priceHistory);
    res.json({ candles });
  } catch (error) {
    console.error('Error generating candles:', error);
    res.status(500).json({ error: 'Failed to generate candles' });
  }
});

function generateCandles(prices, interval = 60000) { // 1 minute intervals
  const candles = [];
  if (prices.length === 0) return candles;
  
  const now = Date.now();
  const startTime = now - (24 * 60 * 60 * 1000); // Last 24 hours
  
  for (let time = startTime; time < now; time += interval) {
    const periodPrices = prices.filter(p => 
      p.timestamp >= time && p.timestamp < time + interval
    );
    
    if (periodPrices.length > 0) {
      const open = periodPrices[0].price;
      const close = periodPrices[periodPrices.length - 1].price;
      const high = Math.max(...periodPrices.map(p => p.price));
      const low = Math.min(...periodPrices.map(p => p.price));
      const volume = periodPrices.reduce((sum, p) => sum + p.volume, 0);
      
      candles.push({
        timestamp: time,
        open,
        high,
        low,
        close,
        volume
      });
    }
  }
  
  return candles;
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Trading Dashboard Server running on port ${PORT}`);
  console.log(`📊 WebSocket server running on port 8080`);
  
  // Use REST API instead of WebSocket to avoid rate limits
  console.log('📈 Using Finnhub REST API for price updates');
  
  setInterval(async () => {
    if (FINNHUB_API_KEY) {
      try {
        const response = await axios.get(`https://finnhub.io/api/v1/quote?symbol=BTCUSDT&token=${FINNHUB_API_KEY}`);
        if (response.data && response.data.c) {
          currentPrice = response.data.c;
          priceHistory.push({
            x: Date.now(),
            y: currentPrice
          });
          
          if (priceHistory.length > 1000) {
            priceHistory.shift();
          }
          
          broadcastToClients({
            type: 'price_update',
            price: currentPrice,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        // Silent error handling
      }
    }
  }, 15000); // Every 15 seconds to stay within limits
});
console.log('🔑 Supabase URL:', process.env.SUPABASE_URL ? 'SET' : 'MISSING');
console.log('🔑 Supabase Key:', process.env.SUPABASE_KEY ? 'SET' : 'MISSING');
