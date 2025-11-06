/**
 * Configuration management for IP Monitor Service
 * Validates environment variables and provides default values
 */

const path = require('path');

class Config {
    constructor() {
        this.validateEnvironment();
        this.loadConfig();
    }

    validateEnvironment() {
        const required = [
            'TELEGRAM_TOKEN',
            'TELEGRAM_CHAT_ID'
        ];

        const missing = required.filter(key => !process.env[key]);
        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }

        // Validate chat ID is numeric
        if (isNaN(parseInt(process.env.TELEGRAM_CHAT_ID))) {
            throw new Error('TELEGRAM_CHAT_ID must be a valid number');
        }
    }

    loadConfig() {
        this.telegram = {
            token: process.env.TELEGRAM_TOKEN,
            chatId: parseInt(process.env.TELEGRAM_CHAT_ID),
            timeout: parseInt(process.env.TELEGRAM_TIMEOUT) || 30000,
            retryAttempts: parseInt(process.env.TELEGRAM_RETRY_ATTEMPTS) || 3
        };

        this.ipMonitor = {
            checkInterval: parseInt(process.env.CHECK_INTERVAL_MS) || 60 * 60 * 1000, // 1 hour
            timeout: parseInt(process.env.IP_CHECK_TIMEOUT) || 30000,
            maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
            configPath: process.env.IP_CONFIG_PATH || path.join(process.cwd(), 'src/config/ip.json')
        };

        this.git = {
            enabled: process.env.GIT_COMMIT_ENABLED !== 'false',
            maxRetries: parseInt(process.env.GIT_MAX_RETRIES) || 3,
            timeout: parseInt(process.env.GIT_TIMEOUT) || 60000,
            autoCommit: process.env.GIT_AUTO_COMMIT !== 'false'
        };

        const githubOwner = process.env.GITHUB_OWNER || 'dohoanghuy';
        const githubRepo = process.env.GITHUB_REPO || 'ip-config';
        const githubBranch = process.env.GITHUB_BRANCH || 'main';

        this.github = {
            owner: githubOwner,
            repo: githubRepo,
            branch: githubBranch,
            rawUrl: process.env.GITHUB_RAW_URL || `https://raw.githubusercontent.com/${githubOwner}/${githubRepo}/${githubBranch}/src/config/ip.json`
        };

        this.logging = {
            level: process.env.LOG_LEVEL || 'info',
            enableConsole: process.env.LOG_CONSOLE !== 'false',
            enableFile: process.env.LOG_FILE === 'true',
            filePath: process.env.LOG_FILE_PATH || 'logs/ip-monitor.log'
        };

        this.server = {
            port: parseInt(process.env.PORT) || 3000,
            host: process.env.HOST || '0.0.0.0',
            enableHealthCheck: process.env.HEALTH_CHECK !== 'false'
        };

        this.rateLimiting = {
            notificationWindow: parseInt(process.env.NOTIFICATION_RATE_WINDOW) || 60000, // 1 minute
            maxNotifications: parseInt(process.env.MAX_NOTIFICATIONS_PER_WINDOW) || 5,
            debounceDelay: parseInt(process.env.DEBOUNCE_DELAY) || 5000
        };
    }

    // Getters for easy access
    get telegramToken() { return this.telegram.token; }
    get telegramChatId() { return this.telegram.chatId; }
    get checkInterval() { return this.ipMonitor.checkInterval; }
    get ipConfigPath() { return this.ipMonitor.configPath; }
    get githubRawUrl() { return this.github.rawUrl; }

    // Validation helpers
    isProduction() {
        return process.env.NODE_ENV === 'production';
    }

    isDevelopment() {
        return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
    }

    toString() {
        // Return config without sensitive information for logging
        return JSON.stringify({
            telegram: {
                chatId: this.telegram.chatId,
                timeout: this.telegram.timeout,
                retryAttempts: this.telegram.retryAttempts
            },
            ipMonitor: this.ipMonitor,
            git: this.git,
            github: {
                owner: this.github.owner,
                repo: this.github.repo,
                branch: this.github.branch
            },
            logging: this.logging,
            server: this.server,
            rateLimiting: this.rateLimiting,
            environment: process.env.NODE_ENV || 'development'
        }, null, 2);
    }
}

module.exports = Config;