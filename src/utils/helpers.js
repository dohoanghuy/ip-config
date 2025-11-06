/**
 * Utility functions for IP Monitor Service
 * Includes validation, debouncing, rate limiting, and common operations
 */

const { promisify } = require('util');
const { exec } = require('child_process');
const execAsync = promisify(exec);

/**
 * Sleep utility for delays and exponential backoff
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Validate IP address format
 */
const isValidIp = (ip) => {
    if (!ip || typeof ip !== 'string') return false;

    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
};

/**
 * Sanitize input for git commit messages
 */
const sanitizeGitMessage = (message) => {
    if (!message || typeof message !== 'string') return 'Update IP';

    return message
        .replace(/[`$(){}[\]|&;]/g, '') // Remove potentially dangerous characters
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim()
        .substring(0, 100); // Limit length
};

/**
 * Debounce function to prevent rapid successive calls
 */
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
};

/**
 * Rate limiter for notifications
 */
class RateLimiter {
    constructor(maxCalls = 5, windowMs = 60000) {
        this.maxCalls = maxCalls;
        this.windowMs = windowMs;
        this.calls = [];
    }

    isAllowed() {
        const now = Date.now();
        // Remove calls outside the current window
        this.calls = this.calls.filter(callTime => now - callTime < this.windowMs);

        if (this.calls.length < this.maxCalls) {
            this.calls.push(now);
            return true;
        }

        return false;
    }

    reset() {
        this.calls = [];
    }

    getStatus() {
        const now = Date.now();
        this.calls = this.calls.filter(callTime => now - callTime < this.windowMs);

        return {
            remaining: Math.max(0, this.maxCalls - this.calls.length),
            resetTime: this.calls.length > 0 ? this.calls[0] + this.windowMs : now
        };
    }
}

/**
 * Retry wrapper with exponential backoff
 */
const withRetry = async (fn, maxRetries = 3, baseDelay = 1000) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === maxRetries) {
                throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
            }

            const delay = baseDelay * Math.pow(2, attempt - 1);
            await sleep(delay);
        }
    }
};

/**
 * Safe JSON parse with error handling
 */
const safeJsonParse = (jsonString, defaultValue = null) => {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        return defaultValue;
    }
};

/**
 * Format timestamp for logging
 */
const formatTimestamp = (date = new Date()) => {
    return date.toISOString();
};

/**
 * Clean string by removing quotes and whitespace
 */
const cleanString = (str) => {
    if (!str || typeof str !== 'string') return '';

    return str
        .toString()
        .trim()
        .replace(/^["']+|["']+$/g, '') // Remove leading/trailing quotes
        .replace(/\n/g, ''); // Remove newlines
};

/**
 * Validate environment variable as boolean
 */
const parseBooleanEnv = (envValue, defaultValue = false) => {
    if (envValue === undefined || envValue === null) return defaultValue;

    const lowercased = envValue.toString().toLowerCase();
    return lowercased === 'true' || lowercased === '1' || lowercased === 'yes';
};

/**
 * Execute shell command with timeout and error handling
 */
const executeCommand = async (command, options = {}) => {
    const { timeout = 30000, cwd = process.cwd() } = options;

    try {
        const { stdout, stderr } = await execAsync(command, {
            cwd,
            timeout,
            encoding: 'utf8'
        });

        if (stderr && stderr.trim()) {
            throw new Error(`Command stderr: ${stderr}`);
        }

        return cleanString(stdout);
    } catch (error) {
        throw new Error(`Command execution failed: ${error.message}`);
    }
};

/**
 * Health check status manager
 */
class HealthStatus {
    constructor() {
        this.reset();
    }

    reset() {
        this.status = {
            healthy: true,
            lastCheck: null,
            lastSuccess: null,
            lastIpChange: null,
            errorCount: 0,
            totalChecks: 0,
            uptime: Date.now(),
            errors: []
        };
    }

    recordCheck(success = true, error = null) {
        this.status.lastCheck = Date.now();
        this.status.totalChecks++;

        if (success) {
            this.status.lastSuccess = this.status.lastCheck;
            this.status.healthy = true;
            // Reset error count on success
            if (this.status.errorCount > 0) {
                this.status.errorCount = 0;
                this.status.errors = [];
            }
        } else {
            this.status.errorCount++;
            this.status.healthy = this.status.errorCount < 5; // Unhealthy after 5 consecutive errors

            if (error) {
                this.status.errors.push({
                    timestamp: this.status.lastCheck,
                    message: error.message || error.toString(),
                    stack: error.stack
                });

                // Keep only last 10 errors
                if (this.status.errors.length > 10) {
                    this.status.errors = this.status.errors.slice(-10);
                }
            }
        }
    }

    recordIpChange(oldIp, newIp) {
        this.status.lastIpChange = {
            timestamp: Date.now(),
            oldIp,
            newIp
        };
    }

    getStatus() {
        return {
            ...this.status,
            uptimeMs: Date.now() - this.status.uptime,
            uptimeHours: Math.round((Date.now() - this.status.uptime) / (1000 * 60 * 60) * 100) / 100
        };
    }

    isHealthy() {
        return this.status.healthy;
    }
}

module.exports = {
    sleep,
    isValidIp,
    sanitizeGitMessage,
    debounce,
    RateLimiter,
    withRetry,
    safeJsonParse,
    formatTimestamp,
    cleanString,
    parseBooleanEnv,
    executeCommand,
    HealthStatus
};