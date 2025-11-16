class TradingDashboard {
    constructor() {
        this.ws = null;
        this.chart = null;
        this.currentPrice = 0;
        this.trades = [];
        this.init();
    }
    
    init() {
        this.setupWebSocket();
        this.setupChart();
        this.loadInitialData();
        
        // Update data every 30 seconds
        setInterval(() => {
            this.loadTrades();
            this.loadStats();
        }, 30000);
    }
    
    setupWebSocket() {
        // Use HTTP polling for simplicity
        this.startPricePolling();
    }
    
    startPricePolling() {
        setInterval(async () => {
            try {
                const response = await fetch('/api/current-price');
                const data = await response.json();
                if (data.price) {
                    this.updatePrice({ price: data.price, timestamp: Date.now() });
                }
            } catch (error) {
                console.error('Error fetching current price:', error);
            }
        }, 5000);
    }
    
    updatePrice(data) {
        this.currentPrice = data.price;
        document.getElementById('currentPrice').textContent = `$${this.currentPrice.toLocaleString()}`;
    }
    
    setupChart() {
        const chartContainer = document.getElementById('priceChart');
        if (!chartContainer) {
            console.error('Chart container not found');
            return;
        }
        
        // ApexCharts - reliable and modern
        const options = {
            series: [{
                name: 'BTC/USD',
                data: []
            }],
            chart: {
                type: 'candlestick',
                height: 400,
                background: '#1e222d',
                toolbar: {
                    show: true,
                    tools: {
                        zoom: true,
                        zoomin: true,
                        zoomout: true,
                        pan: true,
                        reset: true
                    }
                }
            },
            theme: {
                mode: 'dark'
            },
            plotOptions: {
                candlestick: {
                    colors: {
                        upward: '#4bffb5',
                        downward: '#ff4976'
                    }
                }
            },
            xaxis: {
                type: 'datetime',
                labels: {
                    style: {
                        colors: '#848e9c'
                    }
                }
            },
            yaxis: {
                tooltip: {
                    enabled: true
                },
                labels: {
                    style: {
                        colors: '#848e9c'
                    },
                    formatter: function (val) {
                        return '$' + val.toLocaleString();
                    }
                }
            },
            grid: {
                borderColor: '#2b3139'
            }
        };

        this.chart = new ApexCharts(chartContainer, options);
        this.chart.render();
        
        console.log('ApexCharts candlestick chart created successfully');
    }
    
    async loadInitialData() {
        console.log('Loading initial data...');
        try {
            await Promise.all([
                this.loadCandles(),
                this.loadTrades(),
                this.loadStats()
            ]);
            console.log('All data loaded successfully');
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }
    
    async loadCandles() {
        try {
            const response = await fetch('/api/candles');
            const data = await response.json();
            
            if (data.candles && data.candles.length > 0 && this.chart) {
                // Format data for ApexCharts candlestick
                const formattedData = data.candles.map(candle => ({
                    x: new Date(candle.x),
                    y: [
                        parseFloat(candle.o), // open
                        parseFloat(candle.h), // high
                        parseFloat(candle.l), // low
                        parseFloat(candle.c)  // close
                    ]
                }));

                // Update chart with new data
                this.chart.updateSeries([{
                    name: 'BTC/USD',
                    data: formattedData
                }]);

                console.log(`Loaded ${formattedData.length} candles to ApexCharts`);
            } else {
                console.log('No candles data or chart not ready');
            }
        } catch (error) {
            console.error('Error loading candles:', error);
        }
    }
    
    async loadTrades() {
        try {
            const response = await fetch('/api/trades');
            const data = await response.json();
            this.trades = data.trades || [];
            
            const tradesContainer = document.getElementById('recentTrades');
            if (!tradesContainer) {
                console.error('Trades container not found');
                return;
            }
            
            if (this.trades.length > 0) {
                tradesContainer.innerHTML = this.trades.slice(0, 10).map(trade => `
                    <div class="trade-item ${trade.direction}">
                        <span class="trade-direction">${trade.direction.toUpperCase()}</span>
                        <span class="trade-price">$${trade.entry_price}</span>
                        <span class="trade-pnl ${(trade.pnl || 0) >= 0 ? 'positive' : 'negative'}">
                            ${(trade.pnl || 0) >= 0 ? '+' : ''}$${(trade.pnl || 0).toFixed(2)}
                        </span>
                    </div>
                `).join('');
            } else {
                tradesContainer.innerHTML = '<div class="no-trades">No trades yet</div>';
            }
        } catch (error) {
            console.error('Error loading trades:', error);
        }
    }
    
    async loadStats() {
        try {
            const response = await fetch('/api/stats');
            const data = await response.json();
            
            document.getElementById('totalTrades').textContent = data.totalTrades || 0;
            document.getElementById('winningTrades').textContent = data.winningTrades || 0;
            document.getElementById('winRate').textContent = (data.winRate || 0) + '%';
            document.getElementById('totalPnL').textContent = '$' + (data.totalPnL || 0);
            
            const bestTrade = this.trades.reduce((best, trade) => {
                return (trade.pnl || 0) > (best.pnl || 0) ? trade : best;
            }, { pnl: 0 });
            
            document.getElementById('bestTrade').textContent = '$' + (bestTrade.pnl || 0).toFixed(2);
            
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    new TradingDashboard();
});
