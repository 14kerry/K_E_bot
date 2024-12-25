class DerivAPI {
    constructor(app_id, api_token) {
        this.app_id = app_id;
        this.api_token = api_token;
        this.ws = null;
        this.subscriptions = new Map();
        this.messageQueue = [];
        this.isConnected = false;
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 5;
        this.connect();
    }

    connect() {
        try {
            this.ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${this.app_id}`);
            
            this.ws.onopen = () => {
                console.log('WebSocket connection established');
                this.isConnected = true;
                this.connectionAttempts = 0;
                
                if (this.api_token) {
                    this.authorize();
                }

                // Process any queued messages
                while (this.messageQueue.length > 0) {
                    const data = this.messageQueue.shift();
                    this.send(data);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket connection closed');
                this.isConnected = false;
                
                // Attempt to reconnect with exponential backoff
                if (this.connectionAttempts < this.maxConnectionAttempts) {
                    const delay = Math.min(1000 * Math.pow(2, this.connectionAttempts), 10000);
                    this.connectionAttempts++;
                    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.connectionAttempts})`);
                    setTimeout(() => this.connect(), delay);
                } else {
                    console.error('Max connection attempts reached. Please check your internet connection and refresh the page.');
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.isConnected = false;
            };
        } catch (error) {
            console.error('Error creating WebSocket connection:', error);
            this.isConnected = false;
        }
    }

    send(data) {
        if (!this.ws || !this.isConnected) {
            console.log('WebSocket not connected, queueing message:', data);
            this.messageQueue.push(data);
            return;
        }

        try {
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(data));
            } else {
                console.log('WebSocket not in OPEN state, queueing message:', data);
                this.messageQueue.push(data);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.messageQueue.push(data);
        }
    }

    authorize() {
        const request = {
            authorize: this.api_token
        };
        this.send(request);
    }

    subscribeToDigitTicks(symbol, callback) {
        // Unsubscribe from existing subscription for this symbol if it exists
        if (this.subscriptions.has(symbol)) {
            this.unsubscribeBySymbol(symbol);
        }

        const request = {
            ticks: symbol,
            subscribe: 1
        };

        const handler = (event) => {
            try {
                const response = JSON.parse(event.data);
                if (response.error) {
                    console.error('Error in tick response:', response.error);
                    return;
                }
                callback(response);
            } catch (error) {
                console.error('Error processing tick data:', error);
            }
        };

        this.ws.addEventListener('message', handler);
        this.subscriptions.set(symbol, handler);
        this.send(request);
    }

    unsubscribeBySymbol(symbol) {
        const handler = this.subscriptions.get(symbol);
        if (handler) {
            this.ws.removeEventListener('message', handler);
            this.send({
                forget_all: 'ticks'
            });
            this.subscriptions.delete(symbol);
        }
    }

    unsubscribeFromAllTicks() {
        this.subscriptions.forEach((handler, symbol) => {
            this.ws.removeEventListener('message', handler);
        });
        this.subscriptions.clear();
        this.send({
            forget_all: 'ticks'
        });
    }

    subscribeToBalanceForAccount(loginid, callback) {
        const balanceRequest = {
            balance: 1,
            subscribe: 1,
            loginid: loginid
        };

        const handler = (event) => {
            try {
                const response = JSON.parse(event.data);
                if (response.error) {
                    console.error('Error in balance response:', response.error);
                    return;
                }
                if (response.msg_type === 'balance') {
                    callback(response);
                }
            } catch (error) {
                console.error('Error processing balance data:', error);
            }
        };

        this.ws.addEventListener('message', handler);
        this.send(balanceRequest);
    }

    getAccountList(callback) {
        const request = {
            account_list: 1
        };

        const handler = (event) => {
            try {
                const response = JSON.parse(event.data);
                if (response.error) {
                    console.error('Error in account list response:', response.error);
                    return;
                }
                if (response.msg_type === 'account_list') {
                    callback(response);
                    this.ws.removeEventListener('message', handler);
                }
            } catch (error) {
                console.error('Error processing account list data:', error);
            }
        };

        this.ws.addEventListener('message', handler);
        this.send(request);
    }

    getPriceProposal(parameters, callback) {
        const request = {
            proposal: 1,
            subscribe: 0,
            ...parameters
        };

        const handler = (event) => {
            try {
                const response = JSON.parse(event.data);
                if (response.error) {
                    console.error('Error in proposal response:', response.error);
                    callback(response);
                    return;
                }
                if (response.msg_type === 'proposal') {
                    callback(response);
                    this.ws.removeEventListener('message', handler);
                }
            } catch (error) {
                console.error('Error processing proposal data:', error);
            }
        };

        this.ws.addEventListener('message', handler);
        this.send(request);
    }

    buyContract(parameters, callback) {
        const request = {
            buy: parameters.contract_id,
            price: parameters.price
        };

        const handler = (event) => {
            try {
                const response = JSON.parse(event.data);
                if (response.error) {
                    console.error('Error in buy contract response:', response.error);
                    callback(response);
                    return;
                }
                if (response.msg_type === 'buy') {
                    callback(response);
                    this.ws.removeEventListener('message', handler);
                }
            } catch (error) {
                console.error('Error processing buy contract data:', error);
            }
        };

        this.ws.addEventListener('message', handler);
        this.send(request);
    }
} 