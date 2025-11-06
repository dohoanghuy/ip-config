/**
 * IP Detection Service with multiple fallback methods
 * Provides reliable public IP address detection with validation
 */

const axios = require('axios');
const { executeCommand, isValidIp, cleanString, withRetry } = require('../utils/helpers');
const { logger } = require('../util');

class IpDetectionService {
    constructor(config) {
        this.config = config;
        this.timeout = config.ipMonitor.timeout;

        // Define detection methods in order of preference
        this.detectionMethods = [
            {
                name: 'Google DNS',
                method: () => this.getIpByGoogleDns(),
                priority: 1
            },
            {
                name: 'IPify API',
                method: () => this.getIpByIpify(),
                priority: 2
            },
            {
                name: 'AWS CheckIP',
                method: () => this.getIpByAws(),
                priority: 3
            },
            {
                name: 'HTTPBin',
                method: () => this.getIpByHttpBin(),
                priority: 4
            },
            {
                name: 'ICanHazIP',
                method: () => this.getIpByICanHazIp(),
                priority: 5
            }
        ];
    }

    /**
     * Get public IP using Google DNS (most reliable)
     */
    async getIpByGoogleDns() {
        const command = 'dig -4 TXT +short o-o.myaddr.l.google.com @ns1.google.com';
        const result = await executeCommand(command, { timeout: this.timeout });
        return cleanString(result);
    }

    /**
     * Get public IP using IPify API
     */
    async getIpByIpify() {
        const response = await axios.get('https://api.ipify.org?format=text', {
            timeout: this.timeout,
            headers: {
                'User-Agent': 'ip-monitor/1.0'
            }
        });
        return cleanString(response.data);
    }

    /**
     * Get public IP using AWS CheckIP service
     */
    async getIpByAws() {
        const response = await axios.get('https://checkip.amazonaws.com', {
            timeout: this.timeout,
            headers: {
                'User-Agent': 'ip-monitor/1.0'
            }
        });
        return cleanString(response.data);
    }

    /**
     * Get public IP using HTTPBin
     */
    async getIpByHttpBin() {
        const response = await axios.get('https://httpbin.org/ip', {
            timeout: this.timeout,
            headers: {
                'User-Agent': 'ip-monitor/1.0'
            }
        });
        return response.data.origin;
    }

    /**
     * Get public IP using ICanHazIP
     */
    async getIpByICanHazIp() {
        const response = await axios.get('https://icanhazip.com', {
            timeout: this.timeout,
            headers: {
                'User-Agent': 'ip-monitor/1.0'
            }
        });
        return cleanString(response.data);
    }

    /**
     * Get public IP with fallback methods
     */
    async getPublicIp() {
        const errors = [];

        // Sort methods by priority
        const sortedMethods = [...this.detectionMethods].sort((a, b) => a.priority - b.priority);

        for (const { name, method } of sortedMethods) {
            try {
                logger.info(`Attempting IP detection using ${name}`);

                const ip = await withRetry(method, 2, 1000); // 2 retries with 1s base delay

                if (isValidIp(ip)) {
                    logger.info(`Successfully detected IP using ${name}: ${ip}`);
                    return {
                        ip,
                        method: name,
                        timestamp: new Date().toISOString(),
                        success: true
                    };
                } else {
                    throw new Error(`Invalid IP format received: ${ip}`);
                }
            } catch (error) {
                const errorMsg = `${name} failed: ${error.message}`;
                logger.warn(errorMsg);
                errors.push({ method: name, error: errorMsg });
            }
        }

        // All methods failed
        const errorSummary = errors.map(e => `${e.method}: ${e.error}`).join('; ');
        throw new Error(`All IP detection methods failed. Errors: ${errorSummary}`);
    }

    /**
     * Get IP from remote GitHub repository
     */
    async getRemoteIp() {
        try {
            logger.info(`Fetching remote IP from: ${this.config.githubRawUrl}`);

            const response = await axios.get(this.config.githubRawUrl, {
                timeout: this.timeout,
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache',
                    'User-Agent': 'ip-monitor/1.0'
                }
            });

            const data = response.data;
            const remoteIp = data['crypto-web-tool'];

            if (!remoteIp || !isValidIp(remoteIp)) {
                throw new Error(`Invalid remote IP format: ${remoteIp}`);
            }

            logger.info(`Successfully fetched remote IP: ${remoteIp}`);
            return {
                ip: remoteIp,
                timestamp: new Date().toISOString(),
                source: 'github-remote'
            };
        } catch (error) {
            logger.error('Failed to fetch remote IP:', error);
            throw new Error(`Failed to fetch remote IP: ${error.message}`);
        }
    }

    /**
     * Compare two IP addresses
     */
    compareIps(ip1, ip2) {
        if (!ip1 || !ip2) return false;
        return ip1.toString().trim() === ip2.toString().trim();
    }

    /**
     * Validate IP detection service health
     */
    async validateService() {
        try {
            const result = await this.getPublicIp();
            return {
                healthy: true,
                ip: result.ip,
                method: result.method,
                timestamp: result.timestamp
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Get service statistics
     */
    getStats() {
        return {
            availableMethods: this.detectionMethods.length,
            methods: this.detectionMethods.map(m => ({
                name: m.name,
                priority: m.priority
            })),
            timeout: this.timeout,
            remoteSource: this.config.githubRawUrl
        };
    }
}

module.exports = IpDetectionService;