const config = {
    app_id: process.env.DERIV_APP_ID || 'YOUR_DERIV_APP_ID',
    api_token: process.env.DERIV_API_TOKEN || 'YOUR_DERIV_API_TOKEN',
    base_path: location.hostname === 'localhost' ? '' : '/New-folder',
    oauth: {
        redirect_uri: location.hostname === 'localhost' 
            ? window.location.origin + '/redirect.html'
            : window.location.origin + '/New-folder/redirect.html',
        post_login_redirect: location.hostname === 'localhost'
            ? '/index.html'
            : '/New-folder/index.html',
        post_logout_redirect: location.hostname === 'localhost'
            ? '/login.html'
            : '/New-folder/login.html'
    }
}; 