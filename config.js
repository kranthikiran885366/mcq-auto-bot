// Configuration for different environments
const CONFIG = {
  development: {
    API_BASE: 'http://localhost:5000/api',
    DEBUG: true,
    ENVIRONMENT: 'development'
  },
  production: {
    API_BASE: 'https://mcq-bot-backend.onrender.com/api', // Replace with your Render URL
    DEBUG: false,
    ENVIRONMENT: 'production'
  }
};

// Detect environment (default to production for safety)
const ENVIRONMENT = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) 
  ? (chrome.runtime.getManifest().version.includes('dev') ? 'development' : 'production')
  : 'production';

// Export configuration
const APP_CONFIG = CONFIG[ENVIRONMENT];

// Make it available globally
if (typeof window !== 'undefined') {
  window.APP_CONFIG = APP_CONFIG;
}

// For Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = APP_CONFIG;
}