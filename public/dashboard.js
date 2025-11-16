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
        const chartContainer = document.getElementById('priceChart');
        
        try {
            // Create chart with minimal config
            this.chart = LightweightCharts.createChart(chartContainer, {
                width: chartContainer.clientWidth || 800,
                height: chartContainer.clientHeight || 400,
                layout: {
                    backgroundColor: '#161a1e',
                    textColor: '#d1d4dc',
                },
                grid: {
                    vertLines: { color: '#2b3139' },
                    horzLines: { color: '#2b3139' },
                },
                rightPriceScale: {
                    borderColor: '#2b3139',
                },
                timeScale: {
                    borderColor: '#2b3139',
                },
            });

            // Add candlestick series
            this.candlestickSeries = this.chart.addCandlestickSeries({
                upColor: '#02c076',
                downColor: '#f84960',
                borderDownColor: '#f84960',
                borderUpColor: '#02c076',
                wickDownColor: '#f84960',
                wickUpColor: '#02c076',
            });

            console.log('Chart created successfully');
            
            // Load demo data immediately
            this.loadDemoData();
            
        } catch (error) {
            console.error('Error creating chart:', error);
            chartContainer.innerHTML = '<div style="color: red; padding: 20px;">Chart failed to load</div>';
        }
    }
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
        console.log('Loading initial data...');
        
        // Show loading state
        document.getElementById('currentPrice').textContent = 'Loading...';
        
        try {
            await Promise.all([
                this.loadCandles(),
                this.loadTrades(),
                this.loadStats(),
                this.loadCurrentPosition()
            ]);
            console.log('All data loaded successfully');
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }

    async loadCandles() {
        try {
            console.log('Loading candles...');
            const response = await fetch('/api/candles');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Candles data received:', data);
            
            if (data.candles && data.candles.length > 0) {
                // Format data for Lightweight Charts - use YYYY-MM-DD format
                const candleData = data.candles.map(candle => ({
                    time: new Date(candle.x).toISOString().split('T')[0], // YYYY-MM-DD format
                    open: candle.o,
                    high: candle.h,
                    low: candle.l,
                    close: candle.c
                }));

                const volumeData = data.candles.map(candle => ({
                    time: new Date(candle.x).toISOString().split('T')[0],
                    value: candle.v,
                    color: candle.c >= candle.o ? '#02c076' : '#f84960'
                }));

                console.log('Setting candle data:', candleData.length, 'candles');
                console.log('Sample candle:', candleData[0]);
                
                // Set data to chart
                this.candlestickSeries.setData(candleData);
                this.volumeSeries.setData(volumeData);
                
                // Update current price from latest candle
                const latestCandle = data.candles[data.candles.length - 1];
                if (latestCandle) {
                    this.currentPrice = latestCandle.c;
                    document.getElementById('currentPrice').textContent = `$${this.currentPrice.toLocaleString()}`;
                }
                
                console.log('Chart updated successfully');
            } else {
                console.log('No candles data, using demo data');
                this.loadDemoData();
            }
        } catch (error) {
            console.error('Error loading candles:', error);
            this.loadDemoData();
        }
    }

    loadDemoData() {
        // Demo candlestick data with proper date format
        const demoData = [
            { time: '2025-11-10', open: 96500, high: 97200, low: 96300, close: 97000 },
            { time: '2025-11-11', open: 97000, high: 97800, low: 96800, close: 97500 },
            { time: '2025-11-12', open: 97500, high: 98200, low: 97200, close: 97800 },
            { time: '2025-11-13', open: 97800, high: 98500, low: 97600, close: 98200 },
            { time: '2025-11-14', open: 98200, high: 98800, low: 97900, close: 98400 },
            { time: '2025-11-15', open: 98400, high: 99000, low: 98100, close: 98700 },
        ];
        
        console.log('Loading demo data:', demoData.length, 'candles');
        
        this.candlestickSeries.setData(demoData);
        this.currentPrice = 98700;
        document.getElementById('currentPrice').textContent = `$${this.currentPrice.toLocaleString()}`;
        document.getElementById('balance').textContent = '$10,500';
        document.getElementById('return').textContent = '+5.0%';
        
        console.log('Demo data loaded successfully');
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
        if (!this.candlestickSeries || !this.showTrades) return;
        
        // Create markers for trades
        const markers = [];
        
        this.trades.forEach((trade, index) => {
            if (trade.status === 'closed' && trade.entry_price && trade.exit_price) {
                const entryTime = Math.floor(new Date(trade.timestamp).getTime() / 1000);
                const exitTime = Math.floor(new Date(trade.exit_time).getTime() / 1000);
                
                // Entry marker
                markers.push({
                    time: entryTime,
                    position: 'belowBar',
                    color: trade.direction === 'long' ? '#02c076' : '#f84960',
                    shape: trade.direction === 'long' ? 'arrowUp' : 'arrowDown',
                    text: `${trade.direction.toUpperCase()} $${trade.entry_price.toFixed(0)}`
                });
                
                // Exit marker
                markers.push({
                    time: exitTime,
                    position: 'aboveBar',
                    color: (trade.pnl || 0) > 0 ? '#02c076' : '#f84960',
                    shape: 'circle',
                    text: `EXIT $${trade.exit_price.toFixed(0)} (${(trade.pnl || 0) > 0 ? '+' : ''}$${(trade.pnl || 0).toFixed(2)})`
                });
            }
        });
        
        // Set markers to candlestick series
        this.candlestickSeries.setMarkers(markers);
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
