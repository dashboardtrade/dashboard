const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Supabase clients
const tradesSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const candlesSupabase = createClient(
  process.env.CANDLES_SUPABASE_URL,
  process.env.CANDLES_SUPABASE_KEY
);

// API Routes
app.get('/api/trades', async (req, res) => {
  try {
    const { data, error } = await tradesSupabase
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

app.get('/api/candles', async (req, res) => {
  try {
    const { data, error } = await candlesSupabase
      .from('candles')
      .select('timestamp, open, high, low, close, volume')
      .order('timestamp', { ascending: false })
      .limit(500);

    if (error) throw error;

    const formattedCandles = data.reverse().map(candle => ({
      x: new Date(candle.timestamp),
      o: candle.open,
      h: candle.high,
      l: candle.low,
      c: candle.close,
      v: candle.volume
    }));

    res.json({ candles: formattedCandles });
  } catch (error) {
    console.error('Error fetching candles:', error);
    res.status(500).json({ error: 'Failed to fetch candles' });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const { data, error } = await tradesSupabase
      .from('paper_trades')
      .select('*');
    
    if (error) throw error;

    const totalTrades = data.length;
    const winningTrades = data.filter(trade => (trade.pnl || 0) > 0).length;
    const totalPnL = data.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades * 100).toFixed(1) : 0;

    res.json({
      totalTrades,
      winningTrades,
      winRate,
      totalPnL: totalPnL.toFixed(2)
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// New endpoint for trade markers
app.get('/api/trade-markers', async (req, res) => {
  try {
    const { data, error } = await tradesSupabase
      .from('paper_trades')
      .select('*')
      .order('timestamp', { ascending: true });
    
    if (error) throw error;

    const markers = data.map(trade => ({
      time: Math.floor(new Date(trade.timestamp).getTime() / 1000),
      position: 'belowBar',
      color: trade.direction === 'long' ? '#4bffb5' : '#ff4976',
      shape: trade.direction === 'long' ? 'arrowUp' : 'arrowDown',
      text: `#${trade.trade_id || trade.id} ${trade.direction.toUpperCase()}\nEntry: $${trade.entry_price}\nSL: $${trade.stop_loss || 'N/A'}\nTP: $${trade.take_profit || 'N/A'}\nP&L: ${(trade.pnl || 0) >= 0 ? '+' : ''}$${(trade.pnl || 0).toFixed(2)}`,
      size: 1
    }));

    res.json({ markers });
  } catch (error) {
    console.error('Error fetching trade markers:', error);
    res.status(500).json({ error: 'Failed to fetch trade markers' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Professional Trading Dashboard running on port ${PORT}`);
});
