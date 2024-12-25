class DerivOAuth {
    constructor(config) {
        this.config = {
            client_id: config.app_id,
            redirect_uri: config.redirect_uri || window.location.origin + config.base_path + '/redirect.html',
            scope: 'trading',
            response_type: 'token',
            ...config
        };
        
        this.accounts = null;
        this.currentAccount = null;
        
        // Check if we're on the redirect page
        if (window.location.pathname.includes('/redirect.html')) {
            this.handleRedirect();
        }
    }

    initiateLogin() {
        const baseUrl = 'https://oauth.deriv.com/oauth2/authorize';
        const params = new URLSearchParams(this.config);
        window.location.href = `${baseUrl}?${params.toString()}`;
    }

    handleRedirect() {
        const params = new URLSearchParams(window.location.search);
        const accounts = {};
        let i = 1;
        
        // Extract all account tokens
        while (params.get(`acct${i}`)) {
            accounts[params.get(`acct${i}`)] = {
                token: params.get(`token${i}`),
                currency: params.get(`cur${i}`)
            };
            i++;
        }
        
        if (Object.keys(accounts).length > 0) {
            this.storeAccounts(accounts);
            // Redirect to main application
            window.location.href = this.config.post_login_redirect || config.base_path + '/';
        }
    }

    storeAccounts(accounts) {
        // Store accounts in session storage
        sessionStorage.setItem('deriv_accounts', JSON.stringify(accounts));
        this.accounts = accounts;
        
        // Set first account as current
        const firstAccount = Object.keys(accounts)[0];
        this.setCurrentAccount(firstAccount);
    }

    loadAccounts() {
        const stored = sessionStorage.getItem('deriv_accounts');
        if (stored) {
            this.accounts = JSON.parse(stored);
            return this.accounts;
        }
        return null;
    }

    setCurrentAccount(accountId) {
        if (this.accounts && this.accounts[accountId]) {
            this.currentAccount = accountId;
            sessionStorage.setItem('deriv_current_account', accountId);
            return true;
        }
        return false;
    }

    getCurrentAccount() {
        if (!this.currentAccount) {
            this.currentAccount = sessionStorage.getItem('deriv_current_account');
        }
        return this.currentAccount && this.accounts ? 
            { id: this.currentAccount, ...this.accounts[this.currentAccount] } : 
            null;
    }

    getToken() {
        const current = this.getCurrentAccount();
        return current ? current.token : null;
    }

    isAuthenticated() {
        return !!this.getToken();
    }

    logout() {
        // Clear all stored data
        sessionStorage.removeItem('deriv_accounts');
        sessionStorage.removeItem('deriv_current_account');
        this.accounts = null;
        this.currentAccount = null;
        
        // Redirect to login if specified
        if (this.config.post_logout_redirect) {
            window.location.href = this.config.post_logout_redirect;
        }
    }

    // Initialize WebSocket connection with current token
    initializeWebSocket() {
        const token = this.getToken();
        if (!token) {
            throw new Error('No authentication token available');
        }

        const ws = new WebSocket(
            `wss://ws.binaryws.com/websockets/v3?app_id=${this.config.client_id}`
        );
        
        ws.onopen = () => {
            // Authorize with token
            ws.send(JSON.stringify({ authorize: token }));
        };
        
        return ws;
    }

    // Refresh token implementation (if supported by Deriv)
    async refreshToken() {
        // Implement token refresh logic here if Deriv provides this functionality
        console.warn('Token refresh not implemented');
    }

    // Token rotation
    rotateToken(accountId, newToken) {
        if (this.accounts && this.accounts[accountId]) {
            this.accounts[accountId].token = newToken;
            this.storeAccounts(this.accounts);
            return true;
        }
        return false;
    }

    // Validate token format
    static validateToken(token) {
        // Add your token validation logic here
        return typeof token === 'string' && token.startsWith('a1-');
    }
}

// Example usage:
/*
const oauth = new DerivOAuth({
    app_id: config.app_id,
    redirect_uri: 'https://your-website.com/redirect/',
    post_login_redirect: '/',
    post_logout_redirect: '/login'
});

// Check authentication status
if (!oauth.isAuthenticated()) {
    oauth.initiateLogin();
} else {
    const ws = oauth.initializeWebSocket();
    // Handle WebSocket events...
}
*/ 