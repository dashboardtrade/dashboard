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
            this.loadChartTrades(); // Refresh trade markers
        }, 30000);
    }
    
    setupWebSocket() {
        // Try different WebSocket ports for Render deployment
        const ports = [8080, 8081, window.location.port ? parseInt(window.location.port) + 1 : 8080];
        let wsUrl = `wss://${window.location.hostname}:${ports[0]}`;
        
        // Use WSS for HTTPS sites, WS for HTTP
        if (window.location.protocol === 'https:') {
            wsUrl = `wss://${window.location.hostname}`;
        } else {
            wsUrl = `ws://${window.location.hostname}:8080`;
        }
        
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
        
        // Register the annotation plugin if available
        if (window['chartjs-plugin-annotation']) {
            Chart.register(window['chartjs-plugin-annotation']);
        }
        
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
                    annotation: {
                        annotations: {}
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
            this.loadCurrentPosition(),
            this.loadChartTrades()
        ]);
    }
    
    async loadChartTrades() {
        try {
            const response = await fetch('/api/chart-trades');
            const trades = await response.json();
            this.chartTrades = trades;
            this.updateTradeMarkers();
        } catch (error) {
            console.error('Error loading chart trades:', error);
        }
    }
    
    updateTradeMarkers() {
        if (!this.chart || !this.showTrades) return;
        
        // Remove existing trade annotations
        if (!this.chart.options.plugins.annotation) {
            this.chart.options.plugins.annotation = { annotations: {} };
        }
        this.chart.options.plugins.annotation.annotations = {};
        
        this.chartTrades.forEach(trade => {
            // Entry marker
            const entryColor = trade.direction === 'long' ? '#00d4aa' : '#f6465d';
            const entrySymbol = trade.direction === 'long' ? '▲' : '▼';
            
            this.chart.options.plugins.annotation.annotations[`entry_${trade.id}`] = {
                type: 'point',
                xValue: trade.entryTime,
                yValue: trade.entryPrice,
                backgroundColor: entryColor,
                borderColor: entryColor,
                borderWidth: 2,
                radius: 6,
                label: {
                    content: `${entrySymbol} ${trade.direction.toUpperCase()}`,
                    enabled: true,
                    position: trade.direction === 'long' ? 'bottom' : 'top',
                    backgroundColor: entryColor,
                    color: 'white',
                    font: { size: 10 }
                }
            };
            
            // Exit marker (if trade is closed)
            if (trade.exitTime && trade.exitPrice) {
                const exitColor = trade.result === 'PROFIT' ? '#00d4aa' : '#f6465d';
                const exitSymbol = trade.result === 'PROFIT' ? '✓' : '✗';
                
                this.chart.options.plugins.annotation.annotations[`exit_${trade.id}`] = {
                    type: 'point',
                    xValue: trade.exitTime,
                    yValue: trade.exitPrice,
                    backgroundColor: exitColor,
                    borderColor: exitColor,
                    borderWidth: 2,
                    radius: 5,
                    label: {
                        content: `${exitSymbol} $${trade.pnl.toFixed(2)}`,
                        enabled: true,
                        position: trade.result === 'PROFIT' ? 'top' : 'bottom',
                        backgroundColor: exitColor,
                        color: 'white',
                        font: { size: 9 }
                    }
                };
                
                // Draw line connecting entry and exit
                this.chart.options.plugins.annotation.annotations[`line_${trade.id}`] = {
                    type: 'line',
                    xMin: trade.entryTime,
                    xMax: trade.exitTime,
                    yMin: trade.entryPrice,
                    yMax: trade.exitPrice,
                    borderColor: exitColor,
                    borderWidth: 1,
                    borderDash: [5, 5],
                    opacity: 0.5
                };
            }
        });
        
        this.chart.update('none');
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
        if (!this.chart || !this.showTrades) return;
        
        // Remove existing trade annotations
        if (this.chart.options.plugins.annotation) {
            this.chart.options.plugins.annotation.annotations = {};
        } else {
            this.chart.options.plugins.annotation = { annotations: {} };
        }
        
        // Add trade markers
        this.trades.forEach((trade, index) => {
            if (trade.status === 'closed' && trade.entry_price && trade.exit_price) {
                const entryTime = new Date(trade.timestamp);
                const exitTime = new Date(trade.exit_time);
                
                // Entry marker
                this.chart.options.plugins.annotation.annotations[`entry_${index}`] = {
                    type: 'point',
                    xValue: entryTime,
                    yValue: trade.entry_price,
                    backgroundColor: trade.direction === 'long' ? '#02c076' : '#f84960',
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    radius: 6
                };
                
                // Exit marker
                this.chart.options.plugins.annotation.annotations[`exit_${index}`] = {
                    type: 'point',
                    xValue: exitTime,
                    yValue: trade.exit_price,
                    backgroundColor: (trade.pnl || 0) > 0 ? '#02c076' : '#f84960',
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    radius: 4
                };
                
                // Trade line
                this.chart.options.plugins.annotation.annotations[`line_${index}`] = {
                    type: 'line',
                    xMin: entryTime,
                    xMax: exitTime,
                    yMin: trade.entry_price,
                    yMax: trade.exit_price,
                    borderColor: (trade.pnl || 0) > 0 ? '#02c076' : '#f84960',
                    borderWidth: 1,
                    borderDash: [5, 5]
                };
            }
        });
        
        this.chart.update('none');
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
