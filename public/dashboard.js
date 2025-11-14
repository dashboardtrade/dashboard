class TradingDashboard {
    constructor() {
        this.ws = null;
        this.chart = null;
        this.currentPrice = 0;
        this.priceHistory = [];
        this.trades = [];
        this.currentPosition = null;
        this.showTrades = true;
        this.showVolume = true;
        
        this.init();
    }
    
    init() {
        this.setupWebSocket();
        this.setupChart();
        this.setupEventListeners();
        this.loadInitialData();
        
        // Update data every 30 seconds
        setInterval(() => {
            this.loadTrades();
            this.loadStats();
            this.loadCurrentPosition();
        }, 30000);
    }
    
    setupWebSocket() {
        const wsUrl = `ws://${window.location.hostname}:8080`;
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('📡 Connected to WebSocket');
            this.updateConnectionStatus(true);
        };
        
        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleWebSocketMessage(message);
        };
        
        this.ws.onclose = () => {
            console.log('❌ WebSocket disconnected');
            this.updateConnectionStatus(false);
            // Reconnect after 5 seconds
            setTimeout(() => this.setupWebSocket(), 5000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus(false);
        };
    }
    
    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'price_update':
                this.updatePrice(message.data);
                break;
            default:
                console.log('Unknown message type:', message.type);
        }
    }
    
    updatePrice(data) {
        const previousPrice = this.currentPrice;
        this.currentPrice = data.price;
        
        // Update price display
        document.getElementById('currentPrice').textContent = `$${this.currentPrice.toLocaleString()}`;
        
        // Update price change
        if (previousPrice > 0) {
            const change = ((this.currentPrice - previousPrice) / previousPrice * 100);
            const changeElement = document.getElementById('priceChange');
            changeElement.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
            changeElement.className = `change ${change >= 0 ? 'positive' : 'negative'}`;
        }
        
        // Add to price history
        this.priceHistory.push({
            x: new Date(data.timestamp),
            y: data.price
        });
        
        // Keep only last 1000 points
        if (this.priceHistory.length > 1000) {
            this.priceHistory.shift();
        }
        
        // Update chart
        this.updateChart();
        
        // Update last update time
        document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
    }
    
    setupChart() {
        const ctx = document.getElementById('priceChart').getContext('2d');
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'BTC/USD',
                    data: this.priceHistory,
                    borderColor: '#f0b90b',
                    backgroundColor: 'rgba(240, 185, 11, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#2b3139',
                        titleColor: '#d1d4dc',
                        bodyColor: '#d1d4dc',
                        borderColor: '#f0b90b',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            displayFormats: {
                                minute: 'HH:mm',
                                hour: 'HH:mm'
                            }
                        },
                        grid: {
                            color: '#2b3139'
                        },
                        ticks: {
                            color: '#848e9c'
                        }
                    },
                    y: {
                        position: 'right',
                        grid: {
                            color: '#2b3139'
                        },
                        ticks: {
                            color: '#848e9c',
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                },
                animation: {
                    duration: 0
                }
            }
        });
    }
    
    updateChart() {
        if (this.chart) {
            this.chart.data.datasets[0].data = this.priceHistory;
            this.chart.update('none');
        }
    }
    
    setupEventListeners() {
        // Timeframe buttons
        document.querySelectorAll('.timeframe').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.timeframe').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                // TODO: Implement timeframe switching
            });
        });
        
        // Toggle trades button
        document.getElementById('toggleTrades').addEventListener('click', () => {
            this.showTrades = !this.showTrades;
            document.getElementById('toggleTrades').classList.toggle('active');
            this.updateTradeMarkers();
        });
        
        // Toggle volume button
        document.getElementById('toggleVolume').addEventListener('click', () => {
            this.showVolume = !this.showVolume;
            document.getElementById('toggleVolume').classList.toggle('active');
            // TODO: Implement volume display
        });
    }
    
    async loadInitialData() {
        await Promise.all([
            this.loadTrades(),
            this.loadStats(),
            this.loadCurrentPosition()
        ]);
    }
    
    async loadTrades() {
        try {
            const response = await fetch('/api/trades');
            const data = await response.json();
            this.trades = data.trades;
            this.updateTradesDisplay();
            this.updateTradeMarkers();
        } catch (error) {
            console.error('Error loading trades:', error);
        }
    }
    
    async loadStats() {
        try {
            const response = await fetch('/api/stats');
            const data = await response.json();
            
            document.getElementById('totalTrades').textContent = data.totalTrades;
            document.getElementById('winningTrades').textContent = data.winningTrades;
            document.getElementById('winRate').textContent = data.winRate + '%';
            document.getElementById('totalPnL').textContent = '$' + data.totalPnL;
            
            // Calculate best trade
            const bestTrade = this.trades.reduce((best, trade) => {
                return (trade.pnl || 0) > (best.pnl || 0) ? trade : best;
            }, { pnl: 0 });
            
            document.getElementById('bestTrade').textContent = '$' + (bestTrade.pnl || 0).toFixed(2);
            
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
    
    async loadCurrentPosition() {
        try {
            const response = await fetch('/api/current-position');
            const data = await response.json();
            this.currentPosition = data.position;
            this.updateCurrentPositionDisplay();
        } catch (error) {
            console.error('Error loading current position:', error);
        }
    }
    
    updateCurrentPositionDisplay() {
        const container = document.getElementById('currentPosition');
        
        if (!this.currentPosition) {
            container.innerHTML = '<div class="no-position">No open position</div>';
            return;
        }
        
        const position = this.currentPosition;
        const currentPnL = this.calculateCurrentPnL(position);
        
        container.innerHTML = `
            <div class="position-info">
                <div class="position-header">
                    <span class="position-type ${position.direction}">${position.direction.toUpperCase()}</span>
                    <span class="position-pnl ${currentPnL >= 0 ? 'positive' : 'negative'}">
                        ${currentPnL >= 0 ? '+' : ''}$${currentPnL.toFixed(2)}
                    </span>
                </div>
                <div class="position-details">
                    <div class="position-detail">
                        <span class="label">Entry:</span>
                        <span>$${position.entry_price.toLocaleString()}</span>
                    </div>
                    <div class="position-detail">
                        <span class="label">Current:</span>
                        <span>$${this.currentPrice.toLocaleString()}</span>
                    </div>
                    <div class="position-detail">
                        <span class="label">Stop Loss:</span>
                        <span>$${position.stop_loss.toLocaleString()}</span>
                    </div>
                    <div class="position-detail">
                        <span class="label">Take Profit:</span>
                        <span>$${position.take_profit.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    calculateCurrentPnL(position) {
        if (!position || this.currentPrice === 0) return 0;
        
        const priceDiff = position.direction === 'long' 
            ? this.currentPrice - position.entry_price
            : position.entry_price - this.currentPrice;
            
        return priceDiff * position.position_size;
    }
    
    updateTradesDisplay() {
        const container = document.getElementById('recentTrades');
        
        if (this.trades.length === 0) {
            container.innerHTML = '<div class="loading">No trades yet</div>';
            return;
        }
        
        const recentTrades = this.trades.slice(0, 10);
        
        container.innerHTML = recentTrades.map(trade => `
            <div class="trade-item">
                <div class="trade-info">
                    <div class="trade-id">Trade #${trade.trade_id}</div>
                    <div class="trade-direction ${trade.direction}">${trade.direction.toUpperCase()}</div>
                </div>
                <div class="trade-pnl ${(trade.pnl || 0) >= 0 ? 'positive' : 'negative'}">
                    ${(trade.pnl || 0) >= 0 ? '+' : ''}$${(trade.pnl || 0).toFixed(2)}
                </div>
            </div>
        `).join('');
    }
    
    updateTradeMarkers() {
        // TODO: Add trade markers to chart
        // This would require a more advanced charting library like TradingView
        console.log('Trade markers update requested');
    }
    
    updateConnectionStatus(connected) {
        const statusDot = document.getElementById('connectionStatus');
        const statusText = document.getElementById('connectionText');
        
        if (connected) {
            statusDot.className = 'status-dot connected';
            statusText.textContent = 'Connected';
        } else {
            statusDot.className = 'status-dot disconnected';
            statusText.textContent = 'Disconnected';
        }
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    new TradingDashboard();
});
