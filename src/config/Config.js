/**
 * Simplified Configuration for IP Monitor Service
 * No notifications - just IP detection and Git commits
 */

const path = require('path');
const { logger } = require('../util');

class Config {
    constructor() {
        this.validateEnvironment();
        this.loadConfig();
    }

    validateEnvironment() {
        // No required environment variables for simple mode
        // Everything has sensible defaults
        logger.info('IP Monitor - no notification services required');
    }

    loadConfig() {
        // IP Monitor settings
        this.ipMonitor = {
            checkInterval: parseInt(process.env.CHECK_INTERVAL_MS) || 60 * 60 * 1000, // 1 hour
            timeout: parseInt(process.env.IP_CHECK_TIMEOUT) || 30000,
            maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
            configPath: process.env.IP_CONFIG_PATH || path.join(process.cwd(), 'src/config/ip.json')
        };

        // Git settings (enabled by default)
        this.git = {
            enabled: process.env.GIT_COMMIT_ENABLED !== 'false',
            maxRetries: parseInt(process.env.GIT_MAX_RETRIES) || 3,
            timeout: parseInt(process.env.GIT_TIMEOUT) || 60000,
            autoCommit: process.env.GIT_AUTO_COMMIT !== 'false'
        };

        // GitHub settings for remote IP comparison
        const githubOwner = process.env.GITHUB_OWNER || 'dohoanghuy';
        const githubRepo = process.env.GITHUB_REPO || 'ip-config';
        const githubBranch = process.env.GITHUB_BRANCH || 'main';

        this.github = {
            owner: githubOwner,
            repo: githubRepo,
            branch: githubBranch,
            rawUrl: process.env.GITHUB_RAW_URL || `https://raw.githubusercontent.com/${githubOwner}/${githubRepo}/${githubBranch}/src/config/ip.json`
        };

        // Logging settings
        this.logging = {
            level: process.env.LOG_LEVEL || 'info',
            enableConsole: process.env.LOG_CONSOLE !== 'false',
            enableFile: process.env.LOG_FILE === 'true',
            filePath: process.env.LOG_FILE_PATH || 'logs/ip-monitor.log'
        };

        // Server settings (optional health endpoint)
        this.server = {
            port: parseInt(process.env.PORT) || 3000,
            host: process.env.HOST || '0.0.0.0',
            enableHealthCheck: process.env.HEALTH_CHECK !== 'false'
        };

        // Rate limiting (minimal for simple mode)
        this.rateLimiting = {
            debounceDelay: parseInt(process.env.DEBOUNCE_DELAY) || 5000
        };

        // Paths
        this.configPath = this.ipMonitor.configPath;
        this.checkInterval = this.ipMonitor.checkInterval;
    }

    /**
     * Get service name for logging
     */
    getServiceName() {
        return 'IP Monitor';
    }

    /**
     * Check if running in development mode
     */
    isDevelopment() {
        return process.env.NODE_ENV === 'development';
    }

    /**
     * Get configuration as string for logging
     */
    toString() {
        return JSON.stringify({
            checkInterval: this.checkInterval,
            gitEnabled: this.git.enabled,
            configPath: this.configPath,
            github: this.github,
            server: this.server
        }, null, 2);
    }
}

module.exports = Config;