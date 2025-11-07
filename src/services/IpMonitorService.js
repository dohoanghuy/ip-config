/**
 * Simple IP Monitor Service
 * Core functionality: IP detection and Git commits only
 * No notifications, webhooks, or complex features
 */

const fs = require('fs').promises;
const path = require('path');
const { debounce, HealthStatus, formatTimestamp, isValidIp, safeJsonParse } = require('../utils/helpers');
const { logger } = require('../util');

const IpDetectionService = require('./IpDetectionService');
const GitService = require('./GitService');

class IpMonitorService {
    constructor(config) {
        this.config = config;
        this.isRunning = false;
        this.intervalId = null;
        this.health = new HealthStatus();

        // Initialize core services only
        this.ipDetection = new IpDetectionService(config);
        this.gitService = new GitService(config);

        // Debounced IP check to prevent rapid successive calls
        this.debouncedCheck = debounce(
            this.checkAndUpdateIp.bind(this),
            config.rateLimiting.debounceDelay
        );
    }

    /**
     * Start the monitoring service
     */
    async start() {
        try {
            logger.info('Starting IP Monitor Service...');

            // Validate configuration and services
            await this.validateServices();

            // Perform initial IP check
            await this.performInitialCheck();

            // Start periodic monitoring
            this.startPeriodicMonitoring();

            this.isRunning = true;
            this.health.recordCheck(true);

            logger.info('IP Monitor Service started successfully!');
            return true;

        } catch (error) {
            logger.error('Failed to start IP Monitor Service:', error);
            this.health.recordCheck(false, error);
            throw error;
        }
    }

    /**
     * Stop the monitoring service
     */
    async stop(reason = 'Manual') {
        try {
            logger.info(`Stopping IP Monitor Service: ${reason}`);

            this.isRunning = false;

            // Clear monitoring interval
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }

            logger.info('IP Monitor Service stopped successfully!');

        } catch (error) {
            logger.error('Error stopping IP Monitor Service:', error);
        }
    }

    /**
     * Validate all services before starting
     */
    async validateServices() {
        logger.info('Validating services...');

        // Validate IP detection service
        const ipValidation = await this.ipDetection.validateService();
        if (!ipValidation.healthy) {
            throw new Error(`IP Detection service validation failed: ${ipValidation.error}`);
        }

        // Validate Git service (if enabled)
        if (this.config.git.enabled) {
            const gitValidation = await this.gitService.validateService();
            if (!gitValidation.healthy) {
                logger.warn(`Git service validation failed: ${gitValidation.error}`);
                logger.warn('Continuing without Git integration...');
                this.config.git.enabled = false;
            }
        }

        // Validate IP config file exists
        try {
            await fs.access(this.config.configPath);
        } catch (error) {
            // Create initial config file if it doesn't exist
            await this.createInitialConfig();
        }

        logger.info('Service validation completed successfully');
    }

    /**
     * Create initial IP configuration file
     */
    async createInitialConfig() {
        try {
            logger.info('Creating initial IP configuration file...');

            // Ensure directory exists
            const configDir = path.dirname(this.config.configPath);
            await fs.mkdir(configDir, { recursive: true });

            // Get current IP
            const ipResult = await this.ipDetection.getPublicIp();

            // Create initial config
            const initialConfig = {
                'crypto-web-tool': ipResult.ip,
                lastUpdated: formatTimestamp(),
                createdBy: 'ip-monitor-service'
            };

            await fs.writeFile(
                this.config.configPath,
                JSON.stringify(initialConfig, null, 2),
                'utf8'
            );

            logger.info(`Initial IP config created with IP: ${ipResult.ip}`);

        } catch (error) {
            throw new Error(`Failed to create initial config: ${error.message}`);
        }
    }

    /**
     * Perform initial IP check on service start
     */
    async performInitialCheck() {
        logger.info('Performing initial IP check...');

        try {
            await this.checkAndUpdateIp();
            logger.info('Initial IP check completed successfully');
        } catch (error) {
            logger.error('Initial IP check failed:', error);
            // Don't throw here, let the service continue
        }
    }

    /**
     * Start periodic IP monitoring
     */
    startPeriodicMonitoring() {
        logger.info(`Starting periodic monitoring with ${this.config.checkInterval}ms interval`);

        this.intervalId = setInterval(() => {
            this.debouncedCheck();
        }, this.config.checkInterval);
    }

    /**
     * Main IP check and update logic
     */
    async checkAndUpdateIp() {
        const startTime = Date.now();

        try {
            logger.info('Starting IP check cycle...');

            // Read current IP from config file
            const localIp = await this.readLocalIp();
            logger.info(`Local IP: ${localIp}`);

            // Get current public IP
            const publicIpResult = await this.ipDetection.getPublicIp();
            const publicIp = publicIpResult.ip;
            logger.info(`Public IP: ${publicIp} (via ${publicIpResult.method})`);

            // Get remote IP from GitHub (for comparison)
            let remoteIp;
            try {
                const remoteIpResult = await this.ipDetection.getRemoteIp();
                remoteIp = remoteIpResult.ip;
                logger.info(`Remote IP: ${remoteIp}`);
            } catch (error) {
                logger.warn('Failed to get remote IP, using local for comparison:', error.message);
                remoteIp = localIp; // Fallback to local IP
            }

            // Check if IP update is needed
            const needsUpdate = localIp !== publicIp || remoteIp !== publicIp;

            if (!needsUpdate) {
                logger.info('No IP update needed');
                this.health.recordCheck(true);
                return {
                    updated: false,
                    currentIp: publicIp,
                    message: 'IP unchanged'
                };
            }

            // IP change detected
            logger.info(`IP change detected: ${localIp} -> ${publicIp}`);

            // Update local configuration
            await this.updateLocalConfig(publicIp);

            // Commit to Git if enabled
            if (this.config.git.enabled) {
                await this.commitIpChange(publicIp, localIp);
            } else {
                logger.info('Git integration disabled - skipping commit');
            }

            // Record IP change in health status
            this.health.recordIpChange(localIp, publicIp);
            this.health.recordCheck(true);

            const duration = Date.now() - startTime;
            logger.info(`IP update completed successfully in ${duration}ms`);

            return {
                updated: true,
                oldIp: localIp,
                newIp: publicIp,
                method: publicIpResult.method,
                duration: duration
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error(`IP check failed after ${duration}ms:`, error);

            this.health.recordCheck(false, error);
            throw error;
        }
    }

    /**
     * Read local IP from configuration file
     */
    async readLocalIp() {
        try {
            const configContent = await fs.readFile(this.config.configPath, 'utf8');
            const config = safeJsonParse(configContent, {});

            const ip = config['crypto-web-tool'] || config.ip || null;

            if (!ip || !isValidIp(ip)) {
                throw new Error('Invalid or missing IP in local config');
            }

            return ip;
        } catch (error) {
            throw new Error(`Failed to read local IP: ${error.message}`);
        }
    }

    /**
     * Update local IP configuration file
     */
    async updateLocalConfig(newIp) {
        try {
            logger.info(`Updating local IP config: ${newIp}`);

            // Read existing config
            let existingConfig = {};
            try {
                const configContent = await fs.readFile(this.config.configPath, 'utf8');
                existingConfig = safeJsonParse(configContent, {});
            } catch (error) {
                logger.warn('Could not read existing config, creating new one');
            }

            // Update with new IP
            const updatedConfig = {
                ...existingConfig,
                'crypto-web-tool': newIp,
                lastUpdated: formatTimestamp(),
                lastUpdateBy: 'ip-monitor-service'
            };

            // Write updated config
            await fs.writeFile(
                this.config.configPath,
                JSON.stringify(updatedConfig, null, 2),
                'utf8'
            );

            logger.info('Local IP configuration updated successfully');

        } catch (error) {
            throw new Error(`Failed to update local config: ${error.message}`);
        }
    }

    /**
     * Commit IP change to Git repository
     */
    async commitIpChange(newIp, oldIp) {
        try {
            logger.info('Committing IP change to Git...');

            const result = await this.gitService.commitIpChange(newIp, oldIp);

            if (result.success) {
                logger.info('Git commit completed successfully');
            } else {
                logger.warn(`Git commit skipped: ${result.message}`);
            }

            return result;

        } catch (error) {
            logger.error('Git commit failed:', error);
            // Don't throw here - IP was already updated locally
            logger.warn('IP was updated locally but not committed to repository');
        }
    }

    /**
     * Get service status (simplified)
     */
    async getStatus() {
        try {
            const healthStatus = this.health.getStatus();
            const ipDetectionStats = this.ipDetection.getStats();
            const gitStatus = this.config.git.enabled ? await this.gitService.validateService() : { enabled: false };

            const currentIp = await this.readLocalIp().catch(() => 'Unknown');

            return {
                service: {
                    name: 'IP Monitor',
                    isRunning: this.isRunning,
                    healthy: healthStatus.healthy,
                    checkInterval: this.config.checkInterval,
                    gitEnabled: this.config.git.enabled
                },
                currentIp: currentIp,
                health: healthStatus,
                services: {
                    ipDetection: ipDetectionStats,
                    git: gitStatus
                },
                timestamp: Date.now()
            };

        } catch (error) {
            logger.error('Failed to get service status:', error);
            return {
                service: {
                    name: 'IP Monitor',
                    healthy: false,
                    error: error.message
                },
                timestamp: Date.now()
            };
        }
    }

    /**
     * Get service health for health endpoint
     */
    getHealth() {
        const healthStatus = this.health.getStatus();

        return {
            status: healthStatus.healthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            healthy: healthStatus.healthy,
            uptime: healthStatus.uptime,
            lastCheck: healthStatus.lastCheck,
            errorCount: healthStatus.errorCount,
            services: {
                monitor: this.isRunning,
                git: this.config.git.enabled
            }
        };
    }
}

module.exports = IpMonitorService;