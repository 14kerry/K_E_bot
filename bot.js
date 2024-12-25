// Initialize variables
let digitHistory = [];
let botRunning = false;
let currentTrades = new Map();
let totalTrades = 0;
let winningTrades = 0;
let currentStreak = 0;
let totalPL = 0;
let bot;
let charts;
let gaugeCharts;

// Bot Controller Class
class BotController {
    constructor() {
        this.isRunning = false;
        this.accountType = 'demo';
        this.accounts = {
            demo: {
                balance: 0,
                currency: 'USD',
                totalPL: 0
            },
            real: {
                balance: 0,
                currency: 'USD',
                totalPL: 0
            }
        };
        this.mlFeatures = {
            model: null,
            processData: (data) => {
                // Placeholder for ML processing
                return {
                    signal: 'CALL',
                    confidence: 85,
                    trendStrength: 0.75,
                    volatility: 0.3
                };
            }
        };
        this.settings = {
            riskPerTrade: 0.02,
            maxDailyLoss: 0.1,
            confidenceThreshold: 0.8
        };
        this.stats = {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalProfit: 0,
            currentStreak: 0
        };
    }

    async initialize() {
        try {
            // Initialize ML model
            this.mlFeatures.model = await this.initializeMLModel();
            
            // Set initial account type
            this.setAccountType(document.getElementById('accountType').value);
            
            return true;
        } catch (error) {
            console.error('Failed to initialize bot:', error);
            return false;
        }
    }

    setAccountType(type) {
        if (type !== this.accountType) {
            this.accountType = type;
            logActivity(`Switched to ${type} account`, 'info');
            
            // Update UI to reflect current account
            this.updateAccountDisplay();
            
            // Reset stats for new account
            this.resetStats();
        }
    }

    updateAccountDisplay() {
        const account = this.accounts[this.accountType];
        const prefix = this.accountType;
        
        document.getElementById(`${prefix}-balance`).textContent = 
            `${account.currency} ${account.balance.toFixed(2)}`;
        document.getElementById(`${prefix}-currency`).textContent = 
            account.currency;
        document.getElementById(`${prefix}-pl`).textContent = 
            `${account.totalPL >= 0 ? '+' : ''}${account.totalPL.toFixed(2)}`;
            
        // Highlight active account card
        document.querySelectorAll('.account-card').forEach(card => {
            card.classList.remove('active');
        });
        document.querySelector(`.account-card.${this.accountType}`).classList.add('active');
    }

    resetStats() {
        this.stats = {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalProfit: 0,
            currentStreak: 0
        };
        this.updateStats();
    }

    async initializeMLModel() {
        // Create a simple sequential model
        const model = tf.sequential({
            layers: [
                tf.layers.dense({ inputShape: [10], units: 32, activation: 'relu' }),
                tf.layers.dense({ units: 16, activation: 'relu' }),
                tf.layers.dense({ units: 1, activation: 'sigmoid' })
            ]
        });

        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'binaryCrossentropy',
            metrics: ['accuracy']
        });

        return model;
    }

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            document.getElementById('startBot').disabled = true;
            document.getElementById('stopBot').disabled = false;
            logActivity('Bot started', 'success');
        }
    }

    stop() {
        if (this.isRunning) {
            this.isRunning = false;
            document.getElementById('startBot').disabled = false;
            document.getElementById('stopBot').disabled = true;
            logActivity('Bot stopped', 'info');
        }
    }

    updateStats() {
        document.getElementById('totalTrades').textContent = this.stats.totalTrades;
        document.getElementById('winRate').textContent = 
            this.stats.totalTrades > 0 
                ? ((this.stats.winningTrades / this.stats.totalTrades) * 100).toFixed(1) + '%'
                : '0%';
        document.getElementById('totalPL').textContent = 
            '$' + this.stats.totalProfit.toFixed(2);
        document.getElementById('currentStreak').textContent = this.stats.currentStreak;
    }

    shouldTrade(prediction) {
        return this.isRunning && 
               prediction.confidence >= (this.settings.confidenceThreshold * 100);
    }

    executeTrade(prediction) {
        if (!this.isRunning) return;

        const tradeType = document.getElementById('tradingType').value;
        const stakeAmount = parseFloat(document.getElementById('stakeAmount').value);
        
        // Check if stake amount is valid for current balance
        const currentBalance = this.accounts[this.accountType].balance;
        if (stakeAmount > currentBalance) {
            logActivity(`Insufficient balance for trade. Required: $${stakeAmount}, Available: $${currentBalance}`, 'error');
            return;
        }

        // Simulate trade execution
        const tradeResult = {
            success: Math.random() > 0.4, // 60% win rate simulation
            profit: Math.random() > 0.4 ? stakeAmount * 0.95 : -stakeAmount
        };

        // Update account balance and P/L
        this.accounts[this.accountType].balance += tradeResult.profit;
        this.accounts[this.accountType].totalPL += tradeResult.profit;
        this.updateAccountDisplay();

        // Update stats
        this.stats.totalTrades++;
        if (tradeResult.success) {
            this.stats.winningTrades++;
            this.stats.currentStreak = Math.max(0, this.stats.currentStreak + 1);
        } else {
            this.stats.losingTrades++;
            this.stats.currentStreak = Math.min(0, this.stats.currentStreak - 1);
        }
        this.stats.totalProfit += tradeResult.profit;

        // Update UI
        this.updateStats();
        
        // Log trade result
        const resultMessage = tradeResult.success 
            ? `Trade won: +$${tradeResult.profit.toFixed(2)}`
            : `Trade lost: -$${Math.abs(tradeResult.profit).toFixed(2)}`;
        logActivity(`[${this.accountType.toUpperCase()}] ${resultMessage}`, tradeResult.success ? 'success' : 'error');

        // Add to journal
        this.addTradeToJournal({
            id: this.stats.totalTrades,
            type: tradeType,
            result: tradeResult.success ? 'win' : 'loss',
            profit: tradeResult.profit,
            timestamp: Date.now(),
            account: this.accountType
        });
    }

    addTradeToJournal(trade) {
        const journalEntries = document.getElementById('journalEntries');
        const entry = document.createElement('div');
        entry.className = `trade-entry ${trade.result}`; // win or loss class
        
        entry.innerHTML = `
            <div class="trade-header">
                <span class="trade-id">#${trade.id}</span>
                <span class="trade-time">${new Date(trade.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="trade-details">
                <div class="trade-info">
                    <span class="trade-type">${trade.type}</span>
                    <span class="trade-account">[${trade.account.toUpperCase()}]</span>
                </div>
                <span class="trade-result ${trade.profit >= 0 ? 'profit' : 'loss'}">
                    ${trade.profit >= 0 ? '+' : ''}$${Math.abs(trade.profit).toFixed(2)}
                </span>
            </div>
        `;

        journalEntries.insertBefore(entry, journalEntries.firstChild);
        
        // Keep only the last 50 entries to prevent memory issues
        while (journalEntries.children.length > 50) {
            journalEntries.removeChild(journalEntries.lastChild);
        }
    }

    updateStrategies(activeStrategies) {
        this.activeStrategies = activeStrategies;
        logActivity('Trading strategies updated', 'info');
    }

    updateRiskSettings(settings) {
        this.settings = { ...this.settings, ...settings };
        logActivity('Risk settings updated', 'info');
    }

    canTrade(stakeAmount) {
        // Check if bot is running
        if (!this.isRunning) return false;

        const account = this.accounts[this.accountType];
        
        // Check sufficient balance
        if (stakeAmount > account.balance) {
            logActivity('Insufficient balance for trade', 'error');
            return false;
        }

        // Check risk per trade limit
        if (stakeAmount > account.balance * this.settings.riskPerTrade) {
            logActivity('Trade exceeds risk per trade limit', 'warning');
            return false;
        }

        // Check max daily loss limit
        const dailyLossLimit = account.balance * this.settings.maxDailyLoss;
        if (Math.abs(account.totalPL) > dailyLossLimit) {
            logActivity('Daily loss limit reached', 'warning');
            return false;
        }

        return true;
    }

    reset() {
        // Reset bot state
        this.isRunning = false;
        this.resetStats();
        
        // Reset UI elements
        document.getElementById('startBot').disabled = false;
        document.getElementById('stopBot').disabled = true;
        
        // Clear digit history
        digitHistory = [];
        document.getElementById('digit-history').textContent = '---------';
        
        // Reset all digit boxes
        document.querySelectorAll('.digit-box').forEach(box => {
            box.classList.remove('active');
            const percentageSpan = box.querySelector('.percentage');
            if (percentageSpan) {
                percentageSpan.textContent = '0%';
            }
        });
        
        // Reset charts
        if (charts) {
            charts.mainChart.data.labels = [];
            charts.mainChart.data.datasets[0].data = [];
            charts.mainChart.update();
            
            charts.patternChart.data.datasets[0].data = [];
            charts.patternChart.update();
        }
        
        // Reset gauge charts
        if (gaugeCharts) {
            Object.values(gaugeCharts).forEach(gauge => {
                gauge.data.datasets[0].data = [0, 100];
                gauge.update();
            });
        }
        
        logActivity('Bot reset complete', 'info');
    }
}

class DerivAPI {
    constructor(appId, token) {
        this.appId = appId;
        this.token = token;
        this.subscriptions = new Map();
        this.ws = null;
        this.isConnected = false;
        this.connectionQueue = [];
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${this.appId}`);

                this.ws.onopen = () => {
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    logActivity('WebSocket connection established', 'success');
                    
                    // Authenticate if token is provided
                    if (this.token) {
                        this.authorize(this.token);
                    }

                    // Process queued messages
                    while (this.connectionQueue.length > 0) {
                        const msg = this.connectionQueue.shift();
                        this.ws.send(JSON.stringify(msg));
                    }

                    resolve();
                };

                this.ws.onmessage = (msg) => {
                    const data = JSON.parse(msg.data);
                    this.handleMessage(data);
                };

                this.ws.onerror = (error) => {
                    logActivity('WebSocket error occurred', 'error');
                    reject(error);
                };

                this.ws.onclose = () => {
                    this.isConnected = false;
                    logActivity('WebSocket connection closed', 'warning');
                    this.attemptReconnect();
                };

            } catch (error) {
                reject(error);
            }
        });
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logActivity('Max reconnection attempts reached', 'error');
            return;
        }

        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;

        setTimeout(() => {
            logActivity(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 'info');
            this.connect();
        }, delay);
    }

    authorize(token) {
        return this.send({
            authorize: token
        });
    }

    send(data) {
        if (!this.isConnected) {
            this.connectionQueue.push(data);
            return;
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    handleMessage(data) {
        if (data.error) {
            logActivity(`API Error: ${data.error.message}`, 'error');
            return;
        }

        if (data.authorize) {
            logActivity('Successfully authorized', 'success');
            this.getAccountList((response) => {
                if (response.error) {
                    logActivity('Error getting account list: ' + response.error.message, 'error');
                    return;
                }
                response.account_list.forEach(account => {
                    this.subscribeToBalanceForAccount(account.loginid, (balanceResponse) => {
                        this.updateBalance(balanceResponse);
                    });
                });
            });
        }

        if (data.account_list && this.accountListCallback) {
            this.accountListCallback(data);
        }

        if (data.balance) {
            const callback = this.balanceCallbacks?.get(data.balance.loginid);
            if (callback) callback(data);
        }

        if (data.tick) {
            if (this.tickCallback) {
                this.tickCallback(data);
            }
            this.handleTick(data.tick);
        }

        if (data.history) {
            this.processHistory(data.history);
        }

        if (data.proposal) {
            this.handleProposal(data.proposal);
        }

        if (data.buy) {
            this.handleBuy(data.buy);
        }
    }

    subscribeToTicks(symbol) {
        const request = {
            ticks: symbol,
            subscribe: 1
        };
        this.send(request);
    }

    unsubscribeFromTicks(symbol) {
        if (this.subscriptions.has(symbol)) {
            const request = {
                forget: this.subscriptions.get(symbol)
            };
            this.send(request);
            this.subscriptions.delete(symbol);
        }
    }

    getAccountBalance() {
        this.send({
            balance: 1,
            subscribe: 1
        });
    }

    getPriceProposal(params) {
        this.send({
            proposal: 1,
            subscribe: 1,
            ...params
        });
    }

    buyContract(contractId, price) {
        this.send({
            buy: contractId,
            price: price
        });
    }

    updateBalance(balance) {
        const account = bot.accounts[balance.account_type];
        if (account) {
            account.balance = balance.balance;
            account.currency = balance.currency;
            bot.updateAccountDisplay();
        }
    }

    handleTick(tick) {
        // Store subscription ID for later unsubscribe
        if (tick.id) {
            this.subscriptions.set(tick.symbol, tick.id);
        }

        // Process tick data
        processTick({
            price: tick.quote,
            symbol: tick.symbol,
            epoch: tick.epoch
        });
    }

    handleProposal(proposal) {
        if (proposal.id) {
            this.subscriptions.set('proposal', proposal.id);
        }
        // Update UI with proposal details
        document.getElementById('proposal-info').textContent = 
            `Price: ${proposal.ask_price} | Payout: ${proposal.payout}`;
    }

    handleBuy(buy) {
        if (buy.buy_price) {
            logActivity(`Contract purchased - ID: ${buy.contract_id}`, 'success');
            // Update account balance
            this.getAccountBalance();
        }
    }

    unsubscribeFromAllTicks() {
        this.send({
            forget_all: ['ticks', 'proposal']
        });
        this.subscriptions.clear();
    }

    subscribeToDigitTicks(symbol, callback) {
        const request = {
            ticks_history: symbol,
            adjust_start_time: 1,
            count: 100,
            end: 'latest',
            start: 1,
            style: 'ticks',
            subscribe: 1
        };

        this.send(request);
        this.tickCallback = callback;
    }

    getAccountList(callback) {
        this.send({
            account_list: 1
        });
        this.accountListCallback = callback;
    }

    subscribeToBalanceForAccount(loginid, callback) {
        this.send({
            balance: 1,
            subscribe: 1,
            loginid: loginid
        });
        this.balanceCallbacks = this.balanceCallbacks || new Map();
        this.balanceCallbacks.set(loginid, callback);
    }

    processHistory(history) {
        const prices = history.prices;
        const times = history.times;
        
        // Update chart with historical data
        if (charts && charts.mainChart) {
            charts.mainChart.data.labels = times.map(t => 
                new Date(t * 1000).toLocaleTimeString()
            );
            charts.mainChart.data.datasets[0].data = prices;
            charts.mainChart.update();
        }

        // Process last digits
        prices.forEach((price, index) => {
            const lastDigit = parseInt(price.toString().slice(-1));
            if (index === prices.length - 1) {
                updateDigitDisplay(lastDigit);
            } else {
                digitHistory.unshift(lastDigit);
                if (digitHistory.length > 100) digitHistory.pop();
            }
        });
    }

    requestProposal(params) {
        const request = {
            proposal: 1,
            subscribe: 1,
            ...params
        };
        this.send(request);
    }

    buyContract(params) {
        const request = {
            buy: params.contractId,
            price: params.price
        };
        this.send(request);
    }
}

// Initialize API connection
async function initializeAPI() {
    try {
        const api = new DerivAPI(config.app_id, config.api_token);
        await api.connect();
        return api;
    } catch (error) {
        logActivity('Failed to initialize API connection: ' + error.message, 'error');
        throw error;
    }
}

// Main initialization function
async function initialize() {
    try {
        // Initialize API first
        const api = initializeWebSocketConnection();
        if (!api) {
            throw new Error('Failed to initialize API connection');
        }
        window.api = api;

        // Initialize TensorFlow
        await initializeTensorFlow();
        logActivity('TensorFlow.js initialized', 'success');

        // Initialize charts
        charts = initializeCharts();
        logActivity('Charts initialized', 'info');

        // Initialize gauge charts
        gaugeCharts = initializeGaugeCharts();
        logActivity('Gauge charts initialized', 'info');

        // Initialize bot controller
        bot = new BotController();
        await bot.initialize();
        logActivity('Bot controller initialized', 'success');

        // Initialize event listeners
        initializeEventListeners();
        logActivity('Event listeners initialized', 'info');

        return true;
    } catch (error) {
        console.error('Initialization error:', error);
        logActivity('Failed to initialize: ' + error.message, 'error');
        return false;
    }
}

// Start initialization when document is ready
document.addEventListener('DOMContentLoaded', () => {
    initialize().then(success => {
        if (success) {
            logActivity('Initialization completed successfully', 'success');
        } else {
            logActivity('Initialization failed', 'error');
        }
    }).catch(error => {
        console.error('Initialization error:', error);
        logActivity('Critical initialization error: ' + error.message, 'error');
    });
});

// Initialize TensorFlow.js
async function initializeTensorFlow() {
    await tf.ready();
    console.log('TensorFlow.js initialized');
}

// Initialize Charts
function initializeCharts() {
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 0
        },
        plugins: {
            legend: {
                display: false
            }
        },
        scales: {
            x: {
                display: true,
                grid: {
                    display: false,
                    color: 'rgba(255,255,255,0.1)'
                },
                ticks: {
                    color: 'rgba(255,255,255,0.5)'
                }
            },
            y: {
                display: true,
                grid: {
                    color: 'rgba(255,255,255,0.1)'
                },
                ticks: {
                    color: 'rgba(255,255,255,0.5)'
                }
            }
        }
    };

    // Main Chart
    const mainChartCtx = document.getElementById('mainChart').getContext('2d');
    const mainChart = new Chart(mainChartCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Price',
                data: [],
                borderColor: '#2196F3',
                borderWidth: 2,
                tension: 0.4,
                fill: false
            }]
        },
        options: {
            ...chartOptions,
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });

    // Pattern Recognition Chart
    const patternChartCtx = document.getElementById('patternChart').getContext('2d');
    const patternChart = new Chart(patternChartCtx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Patterns',
                data: [],
                backgroundColor: 'rgba(33,150,243,0.5)'
            }]
        },
        options: {
            ...chartOptions,
            scales: {
                x: {
                    display: false
                },
                y: {
                    display: false
                }
            }
        }
    });

    return {
        mainChart,
        patternChart
    };
}

// Initialize Gauge Charts
function initializeGaugeCharts() {
    const gaugeOptions = {
        type: 'doughnut',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            circumference: 180,
            rotation: -90,
            cutout: '75%',
            animation: {
                duration: 1000
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    };

    // Trend Strength Gauge
    const trendStrengthCtx = document.getElementById('trendStrengthGauge').getContext('2d');
    const trendStrengthGauge = new Chart(trendStrengthCtx, {
        ...gaugeOptions,
        data: {
            datasets: [{
                data: [0, 100],
                backgroundColor: ['#4CAF50', 'rgba(255,255,255,0.1)']
            }]
        }
    });

    // Volatility Gauge
    const volatilityCtx = document.getElementById('volatilityGauge').getContext('2d');
    const volatilityGauge = new Chart(volatilityCtx, {
        ...gaugeOptions,
        data: {
            datasets: [{
                data: [0, 100],
                backgroundColor: ['#FFC107', 'rgba(255,255,255,0.1)']
            }]
        }
    });

    // Confidence Gauge
    const confidenceCtx = document.getElementById('confidenceGauge').getContext('2d');
    const confidenceGauge = new Chart(confidenceCtx, {
        ...gaugeOptions,
        data: {
            datasets: [{
                data: [0, 100],
                backgroundColor: ['#2196F3', 'rgba(255,255,255,0.1)']
            }]
        }
    });

    return {
        trendStrengthGauge,
        volatilityGauge,
        confidenceGauge
    };
}

// Update ML Prediction Display
function updatePredictionDisplay(prediction) {
    const predictionElement = document.getElementById('nextPrediction');
    const confidenceElement = document.getElementById('predictionConfidence');
    const confidenceBar = confidenceElement.querySelector('.confidence-bar');
    const confidenceValue = confidenceElement.querySelector('.confidence-value');

    predictionElement.textContent = prediction.signal;
    predictionElement.className = `prediction-value ${prediction.confidence > 80 ? 'active' : ''}`;
    
    confidenceBar.style.width = `${prediction.confidence}%`;
    confidenceValue.textContent = `${prediction.confidence.toFixed(1)}%`;

    const confidenceClass = prediction.confidence > 80 ? 'high-confidence' : 
                          prediction.confidence > 50 ? 'medium-confidence' : 
                          'low-confidence';
    confidenceBar.className = `confidence-bar ${confidenceClass}`;
}

// Update Performance Metrics
function updatePerformanceMetrics(metrics) {
    document.getElementById('winRate').textContent = `${metrics.winRate.toFixed(1)}%`;
    document.getElementById('profitFactor').textContent = metrics.profitFactor.toFixed(2);
    document.getElementById('expectedValue').textContent = metrics.expectedValue.toFixed(2);
}

// Update Trading Journal
function updateJournal(trade) {
    const journalEntries = document.getElementById('journalEntries');
    const entry = document.createElement('div');
    entry.className = 'journal-entry';
    
    entry.innerHTML = `
        <div class="entry-header">
            <span class="trade-id">#${trade.id}</span>
            <span class="trade-time">${new Date(trade.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="trade-details">
            <span class="trade-type">${trade.type}</span>
            <span class="trade-result ${trade.profit >= 0 ? 'profit' : 'loss'}">
                ${trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
            </span>
            </div>
        <div class="trade-tags">
            ${trade.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
        `;

    journalEntries.insertBefore(entry, journalEntries.firstChild);
}

// Filter Journal Entries
function filterJournalEntries(filter) {
    const entries = document.querySelectorAll('.journal-entry');
    entries.forEach(entry => {
        const profit = parseFloat(entry.querySelector('.trade-result').textContent);
        switch(filter) {
            case 'winning':
                entry.style.display = profit >= 0 ? 'block' : 'none';
                break;
            case 'losing':
                entry.style.display = profit < 0 ? 'block' : 'none';
                break;
            default:
                entry.style.display = 'block';
        }
    });
}

// Search Journal Entries
function searchJournalEntries(query) {
    const entries = document.querySelectorAll('.journal-entry');
    entries.forEach(entry => {
        const text = entry.textContent.toLowerCase();
        entry.style.display = text.includes(query.toLowerCase()) ? 'block' : 'none';
    });
}

// Initialize Event Listeners
function initializeEventListeners() {
    // Trading Type
    document.getElementById('tradingType').addEventListener('change', (e) => {
        logActivity(`Trading type changed to ${e.target.value}`, 'info');
    });

    // Market
    document.getElementById('market').addEventListener('change', (e) => {
        logActivity(`Market changed to ${e.target.value}`, 'info');
    });

    // Strategy Settings
    document.getElementById('stakeAmount').addEventListener('change', (e) => {
        logActivity(`Stake amount updated to $${e.target.value}`, 'info');
    });

    document.getElementById('stopLoss').addEventListener('change', (e) => {
        logActivity(`Stop loss updated to $${e.target.value}`, 'info');
    });

    document.getElementById('takeProfit').addEventListener('change', (e) => {
        logActivity(`Take profit updated to $${e.target.value}`, 'info');
    });

    document.getElementById('martingale').addEventListener('change', (e) => {
        logActivity(`Martingale factor updated to ${e.target.value}`, 'info');
    });

    // Strategy Toggles
    document.querySelectorAll('.strategy-toggle input').forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const strategyName = e.target.id.replace('Strategy', '').toUpperCase();
            logActivity(`${strategyName} strategy ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
            updateActiveStrategies();
        });
    });

    // Risk Settings
    document.getElementById('riskPerTrade').addEventListener('change', (e) => {
        logActivity(`Risk per trade updated to ${e.target.value}%`, 'info');
        updateRiskSettings();
    });

    document.getElementById('maxDailyLoss').addEventListener('change', (e) => {
        logActivity(`Max daily loss updated to ${e.target.value}%`, 'info');
        updateRiskSettings();
    });

    document.getElementById('confidenceThreshold').addEventListener('change', (e) => {
        logActivity(`Confidence threshold updated to ${e.target.value}%`, 'info');
        updateRiskSettings();
    });

    // Journal Controls
    document.getElementById('journalFilter').addEventListener('change', (e) => {
        filterJournalEntries(e.target.value);
        logActivity(`Journal filter changed to ${e.target.value}`, 'info');
    });

    document.getElementById('journalSearch').addEventListener('input', (e) => {
        searchJournalEntries(e.target.value);
    });

    // Account Type
    document.getElementById('accountType').addEventListener('change', (e) => {
        bot.setAccountType(e.target.value);
        logActivity(`Switched to ${e.target.value} account`, 'info');
    });
}

// Update Active Strategies
function updateActiveStrategies() {
    const activeStrategies = {
        ml: document.getElementById('mlStrategy').checked,
        pattern: document.getElementById('patternStrategy').checked,
        trend: document.getElementById('trendStrategy').checked
    };

    bot.updateStrategies(activeStrategies);
}

// Update Risk Settings
function updateRiskSettings() {
    const settings = {
        riskPerTrade: parseFloat(document.getElementById('riskPerTrade').value) / 100,
        maxDailyLoss: parseFloat(document.getElementById('maxDailyLoss').value) / 100,
        confidenceThreshold: parseFloat(document.getElementById('confidenceThreshold').value) / 100
    };

    bot.updateRiskSettings(settings);
}

// Initialize WebSocket Connection
function initializeWebSocket() {
    const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=' + config.app_id);
    
    ws.onopen = () => {
        logActivity('WebSocket connection established', 'success');
        document.getElementById('connection-status').textContent = 'Connected';
        document.getElementById('connection-status').style.backgroundColor = '#e8f5e9';
        
        // Get account balances
        ws.send(JSON.stringify({ balance: 1, account: 'demo' }));
        ws.send(JSON.stringify({ balance: 1, account: 'real' }));
        
        // Subscribe to the selected symbol
        const selectedSymbol = document.getElementById('symbol').value;
        subscribeToPriceStream(ws, selectedSymbol);
    };

    ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.balance) {
            // Update account balance
            const accountType = data.balance.account_type;
            bot.accounts[accountType] = {
                balance: data.balance.balance,
                currency: data.balance.currency,
                totalPL: 0
            };
            bot.updateAccountDisplay();
        } else if (data.tick) {
            processTick(data.tick);
        } else if (data.error) {
            logActivity(`WebSocket error: ${data.error.message}`, 'error');
        }
    };

    ws.onerror = (error) => {
        logActivity('WebSocket error occurred', 'error');
        document.getElementById('connection-status').textContent = 'Connection Error';
        document.getElementById('connection-status').style.backgroundColor = '#ffebee';
    };

    ws.onclose = () => {
        logActivity('WebSocket connection closed', 'warning');
        document.getElementById('connection-status').textContent = 'Disconnected - Reconnecting...';
        document.getElementById('connection-status').style.backgroundColor = '#fff3e0';
        
        // Attempt to reconnect after 5 seconds
        setTimeout(initializeWebSocket, 5000);
    };

    // Add event listener for symbol change
    document.getElementById('symbol').addEventListener('change', (e) => {
        if (ws.readyState === WebSocket.OPEN) {
            subscribeToPriceStream(ws, e.target.value);
            logActivity(`Changed symbol to ${e.target.value}`, 'info');
        }
    });

    return ws;
}

// Helper function to subscribe to price stream
function subscribeToPriceStream(ws, symbol) {
    // Unsubscribe from previous stream if any
    ws.send(JSON.stringify({
        forget_all: ['ticks']
    }));

    // Subscribe to new symbol
    ws.send(JSON.stringify({
        ticks: symbol,
        subscribe: 1
    }));
}

// Process incoming ticks
function processTick(tick) {
    if (!bot.isRunning) return;

    // Update price chart
    updatePriceChart(tick);

    // Get and update last digit
    const lastDigit = parseInt(tick.quote.toString().slice(-1));
    updateLastDigit(lastDigit);

    // Process with ML model
    const prediction = bot.mlFeatures.processData({
        price: tick.quote,
        lastDigit: lastDigit,
        timestamp: tick.timestamp
    });

    // Log prediction
    logActivity(`ML Prediction: ${prediction.signal} (Confidence: ${prediction.confidence.toFixed(1)}%)`, 'info');

    // Update displays
    updatePredictionDisplay(prediction);
    updateIndicators(prediction);

    // Check for trade signals
    if (bot.shouldTrade(prediction)) {
        logActivity(`Trade signal detected: ${prediction.signal}`, 'warning');
        bot.executeTrade(prediction);
    }
}

// Update Price Chart
function updatePriceChart(tick) {
    const chart = charts.mainChart;
    const time = new Date(tick.timestamp * 1000).toLocaleTimeString();

    chart.data.labels.push(time);
    chart.data.datasets[0].data.push(tick.quote);

    // Keep only last 50 data points
    if (chart.data.labels.length > 50) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }

    chart.update('quiet');
}

// Update Indicators
function updateIndicators(prediction) {
    const { trendStrengthGauge, volatilityGauge, confidenceGauge } = gaugeCharts;

    // Update trend strength
    trendStrengthGauge.data.datasets[0].data = [
        prediction.trendStrength * 100,
        100 - (prediction.trendStrength * 100)
    ];
    trendStrengthGauge.update();

    // Update volatility
    volatilityGauge.data.datasets[0].data = [
        prediction.volatility * 100,
        100 - (prediction.volatility * 100)
    ];
    volatilityGauge.update();

    // Update confidence
    confidenceGauge.data.datasets[0].data = [
        prediction.confidence,
        100 - prediction.confidence
    ];
    confidenceGauge.update();
}

// Bot Activity Logging
function logActivity(message, type = 'info') {
    const activityLog = document.getElementById('activityLog');
    const timestamp = new Date().toLocaleTimeString();
    
    const activityMessage = document.createElement('div');
    activityMessage.className = `activity-message ${type}`;
    activityMessage.innerHTML = `<span class="timestamp">${timestamp}</span> ${message}`;
    
    activityLog.insertBefore(activityMessage, activityLog.firstChild);
    
    // Keep only the last 50 messages
    while (activityLog.children.length > 50) {
        activityLog.removeChild(activityLog.lastChild);
    }
}

function updateBotStatus(isActive) {
    const statusIndicator = document.querySelector('.status-indicator');
    const botStatus = document.getElementById('botStatus');
    
    if (isActive) {
        statusIndicator.classList.add('active');
        botStatus.textContent = 'Active';
        logActivity('Bot started', 'success');
    } else {
        statusIndicator.classList.remove('active');
        botStatus.textContent = 'Inactive';
        logActivity('Bot stopped', 'info');
    }
}

// Add the new function to handle last digit updates
function updateLastDigit(digit) {
    // Remove active state and cursor from all boxes
    document.querySelectorAll('.digit-box').forEach(box => {
        box.classList.remove('active');
        const existingCursor = box.querySelector('.digit-cursor');
        if (existingCursor) {
            existingCursor.remove();
        }
    });

    // Add active state and cursor to current digit
    const activeBox = document.querySelector(`.digit-box[data-digit="${digit}"]`);
    if (activeBox) {
        activeBox.classList.add('active');
        const cursor = document.createElement('div');
        cursor.className = 'digit-cursor';
        cursor.textContent = '▲';
        activeBox.appendChild(cursor);
    }

    // Update digit history
    digitHistory.unshift(digit);
    if (digitHistory.length > 10) {
        digitHistory.pop();
    }
    
    // Update history display
    const historyDisplay = document.getElementById('digit-history');
    if (historyDisplay) {
        historyDisplay.textContent = digitHistory.join('');
    }

    // Log the digit
    logActivity(`Last digit: ${digit}`, 'info');
}

function updateDigitDisplay(lastDigit) {
    // Remove previous active states
    document.querySelectorAll('.digit-box').forEach(box => {
        box.classList.remove('active');
    });

    // Add active state to current digit
    const activeBox = document.querySelector(`.digit-box[data-digit="${lastDigit}"]`);
    if (activeBox) {
        activeBox.classList.add('active');
    }

    // Update digit history
    digitHistory.unshift(lastDigit);
    if (digitHistory.length > 100) digitHistory.pop();
    
    // Update history display with colored digits
    const historyDisplay = document.getElementById('digit-history');
    if (historyDisplay) {
        historyDisplay.innerHTML = digitHistory.slice(0, 10).map(digit => 
            `<span style="color: ${getDigitColor(digit)}">${digit}</span>`
        ).join('');
    }

    // Calculate and update percentages
    const digitCounts = {};
    // Initialize counts
    for (let i = 0; i < 10; i++) {
        digitCounts[i] = 0;
    }
    // Count occurrences
    digitHistory.forEach(digit => {
        digitCounts[digit]++;
    });

    // Update percentage displays
    for (let i = 0; i < 10; i++) {
        const percentage = (digitCounts[i] / digitHistory.length * 100).toFixed(1);
        const percentageSpan = document.querySelector(`.digit-box[data-digit="${i}"] .percentage`);
        if (percentageSpan) {
            percentageSpan.textContent = `${percentage}%`;
        }
    }

    // Update bot activity log
    const message = `Last digit: ${lastDigit} (${digitCounts[lastDigit]} times in last 100)`;
    updateActivityLog(message);

    // Update ML predictions if ML strategy is enabled
    if (document.getElementById('mlStrategy').checked) {
        updateMLPredictions(digitHistory);
    }
}

function getDigitColor(digit) {
    const colors = {
        0: '#E91E63', 1: '#9C27B0', 2: '#673AB7',
        3: '#3F51B5', 4: '#2196F3', 5: '#009688',
        6: '#4CAF50', 7: '#8BC34A', 8: '#FFC107',
        9: '#FF5722'
    };
    return colors[digit] || '#000000';
}

function updateActivityLog(message) {
    const activityLog = document.getElementById('activityLog');
    if (!activityLog) return;

    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = 'activity-message';
    logEntry.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;
    
    activityLog.insertBefore(logEntry, activityLog.firstChild);
    
    // Keep only last 50 messages
    while (activityLog.children.length > 50) {
        activityLog.removeChild(activityLog.lastChild);
    }
}

function handleTick(response) {
    if (!response.tick) return;

    const price = response.tick.quote;
    const lastDigit = parseInt(price.toString().slice(-1));
    const timestamp = response.tick.epoch;

    // Update digit display
    updateDigitDisplay(lastDigit);

    // Update chart
    updateChart(price, timestamp);

    // Update bot status if running
    if (botRunning) {
        analyzeTick(price, lastDigit, timestamp);
    }
}

function analyzeTick(price, lastDigit, timestamp) {
    // Get current trading type
    const tradingType = document.getElementById('tradingType').value;
    
    // Calculate probabilities and make trading decisions
    const analysis = {
        price: price,
        lastDigit: lastDigit,
        timestamp: timestamp,
        digitHistory: digitHistory,
        tradingType: tradingType
    };

    // Run enabled strategies
    if (document.getElementById('mlStrategy').checked) {
        analysis.mlPrediction = runMLStrategy(analysis);
    }
    if (document.getElementById('patternStrategy').checked) {
        analysis.patternPrediction = runPatternStrategy(analysis);
    }
    if (document.getElementById('trendStrategy').checked) {
        analysis.trendPrediction = runTrendStrategy(analysis);
    }

    // Combine predictions and check confidence threshold
    const prediction = combinePredictions(analysis);
    const confidenceThreshold = parseFloat(document.getElementById('confidenceThreshold').value);

    if (prediction.confidence >= confidenceThreshold) {
        placeTrade(prediction);
    }
}

// Add event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize bot controls
    document.getElementById('startBot').addEventListener('click', startBot);
    document.getElementById('stopBot').addEventListener('click', stopBot);
    document.getElementById('resetBot').addEventListener('click', resetBot);

    // Initialize trading type change handler
    document.getElementById('tradingType').addEventListener('change', function() {
        updateActivityLog(`Trading type changed to ${this.value}`);
    });

    // Initialize market change handler
    document.getElementById('market').addEventListener('change', function() {
        api.unsubscribeFromAllTicks();
        api.subscribeToDigitTicks(this.value, handleTick);
        updateActivityLog(`Market changed to ${this.value}`);
    });
});

// Add ML Strategy functions
function runMLStrategy(analysis) {
    // Process the last 10 digits for pattern recognition
    const recentDigits = analysis.digitHistory.slice(0, 10);
    const input = tf.tensor2d([recentDigits], [1, 10]);
    
    // Get prediction from model
    const prediction = bot.mlFeatures.model.predict(input);
    const confidence = prediction.dataSync()[0] * 100;
    
    // Determine signal based on confidence
    const signal = confidence > 50 ? 'CALL' : 'PUT';
    
    // Calculate trend strength and volatility
    const trendStrength = calculateTrendStrength(analysis.digitHistory);
    const volatility = calculateVolatility(analysis.digitHistory);
    
    return {
        signal,
        confidence,
        trendStrength,
        volatility
    };
}

function calculateTrendStrength(digits) {
    // Calculate trend strength based on digit sequence
    const recentDigits = digits.slice(0, 20);
    let upCount = 0;
    let downCount = 0;
    
    for (let i = 1; i < recentDigits.length; i++) {
        if (recentDigits[i] > recentDigits[i-1]) upCount++;
        if (recentDigits[i] < recentDigits[i-1]) downCount++;
    }
    
    const totalMoves = upCount + downCount;
    const dominantMoves = Math.max(upCount, downCount);
    
    return totalMoves > 0 ? dominantMoves / totalMoves : 0.5;
}

function calculateVolatility(digits) {
    // Calculate volatility based on digit changes
    const recentDigits = digits.slice(0, 20);
    let changes = 0;
    
    for (let i = 1; i < recentDigits.length; i++) {
        changes += Math.abs(recentDigits[i] - recentDigits[i-1]);
    }
    
    return Math.min(changes / (recentDigits.length * 9), 1);
}

function runPatternStrategy(analysis) {
    const patterns = findPatterns(analysis.digitHistory);
    const confidence = calculatePatternConfidence(patterns);
    
    return {
        signal: confidence > 50 ? 'CALL' : 'PUT',
        confidence,
        patterns
    };
}

function findPatterns(digits) {
    const recentDigits = digits.slice(0, 20);
    const patterns = {
        repeating: 0,
        ascending: 0,
        descending: 0
    };
    
    // Check for repeating digits
    for (let i = 1; i < recentDigits.length; i++) {
        if (recentDigits[i] === recentDigits[i-1]) patterns.repeating++;
    }
    
    // Check for ascending/descending sequences
    for (let i = 2; i < recentDigits.length; i++) {
        if (recentDigits[i] > recentDigits[i-1] && recentDigits[i-1] > recentDigits[i-2]) {
            patterns.ascending++;
        }
        if (recentDigits[i] < recentDigits[i-1] && recentDigits[i-1] < recentDigits[i-2]) {
            patterns.descending++;
        }
    }
    
    return patterns;
}

function calculatePatternConfidence(patterns) {
    const totalPatterns = patterns.repeating + patterns.ascending + patterns.descending;
    const dominantPattern = Math.max(patterns.repeating, patterns.ascending, patterns.descending);
    
    return totalPatterns > 0 ? (dominantPattern / totalPatterns) * 100 : 50;
}

function runTrendStrategy(analysis) {
    const trend = analyzeTrend(analysis.digitHistory);
    const momentum = calculateMomentum(analysis.digitHistory);
    
    return {
        signal: trend.direction,
        confidence: trend.strength * momentum * 100,
        trendData: trend
    };
}

function analyzeTrend(digits) {
    const recentDigits = digits.slice(0, 10);
    let direction = 'NEUTRAL';
    let strength = 0.5;
    
    // Simple moving average
    const avg = recentDigits.reduce((a, b) => a + b, 0) / recentDigits.length;
    const lastDigit = recentDigits[0];
    
    if (lastDigit > avg) {
        direction = 'CALL';
        strength = (lastDigit - avg) / 9;
    } else if (lastDigit < avg) {
        direction = 'PUT';
        strength = (avg - lastDigit) / 9;
    }
    
    return {
        direction,
        strength: Math.min(strength, 1)
    };
}

function calculateMomentum(digits) {
    const recentDigits = digits.slice(0, 5);
    const olderDigits = digits.slice(5, 10);
    
    const recentAvg = recentDigits.reduce((a, b) => a + b, 0) / recentDigits.length;
    const olderAvg = olderDigits.reduce((a, b) => a + b, 0) / olderDigits.length;
    
    const momentum = Math.abs(recentAvg - olderAvg) / 9;
    return Math.min(momentum + 0.5, 1); // Base momentum of 0.5
}

function combinePredictions(analysis) {
    const predictions = [];
    let totalConfidence = 0;
    
    if (analysis.mlPrediction) {
        predictions.push({
            signal: analysis.mlPrediction.signal,
            confidence: analysis.mlPrediction.confidence,
            weight: 0.4
        });
    }
    
    if (analysis.patternPrediction) {
        predictions.push({
            signal: analysis.patternPrediction.signal,
            confidence: analysis.patternPrediction.confidence,
            weight: 0.3
        });
    }
    
    if (analysis.trendPrediction) {
        predictions.push({
            signal: analysis.trendPrediction.signal,
            confidence: analysis.trendPrediction.confidence,
            weight: 0.3
        });
    }
    
    // Calculate weighted confidence
    let weightedConfidence = 0;
    let totalWeight = 0;
    
    predictions.forEach(pred => {
        weightedConfidence += pred.confidence * pred.weight;
        totalWeight += pred.weight;
    });
    
    const finalConfidence = totalWeight > 0 ? weightedConfidence / totalWeight : 0;
    
    // Determine final signal based on weighted majority
    const signals = {};
    predictions.forEach(pred => {
        signals[pred.signal] = (signals[pred.signal] || 0) + pred.weight;
    });
    
    const finalSignal = Object.entries(signals).reduce((a, b) => 
        signals[a] > signals[b] ? a : b
    )[0];
    
    return {
        signal: finalSignal,
        confidence: finalConfidence,
        predictions
    };
}

function placeTrade(prediction) {
    if (!bot.isRunning) return;
    
    const tradeType = document.getElementById('tradingType').value;
    const stakeAmount = parseFloat(document.getElementById('stakeAmount').value);
    
    // Check if we can trade
    if (!bot.canTrade(stakeAmount)) {
        logActivity('Cannot place trade: Risk limits exceeded', 'warning');
        return;
    }
    
    // Execute the trade
    bot.executeTrade({
        type: tradeType,
        direction: prediction.signal,
        amount: stakeAmount,
        confidence: prediction.confidence
    });
}

function initializeWebSocketConnection() {
    if (!config.app_id || !config.api_token) {
        logActivity('Missing app_id or api_token in config', 'error');
        return null;
    }

    const api = new DerivAPI(config.app_id, config.api_token);
    
    api.connect().then(() => {
        // Subscribe to initial market
        const symbol = document.getElementById('symbol').value;
        api.subscribeToTicks(symbol);
        
        // Get account balances
        api.getAccountBalance();
        
        logActivity('API connection established', 'success');
    }).catch(error => {
        logActivity(`API connection failed: ${error.message}`, 'error');
    });

    return api;
} 