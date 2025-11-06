/**
 * Main IP Monitor Service
 * Orchestrates IP detection, file updates, Git operations, and notifications
 */

const fs = require('fs').promises;
const path = require('path');
const { debounce, HealthStatus, formatTimestamp, isValidIp, safeJsonParse } = require('../utils/helpers');
const { logger } = require('../util');

const IpDetectionService = require('./IpDetectionService');
const GitService = require('./GitService');
const TelegramService = require('./TelegramService');

class IpMonitorService {
    constructor(config) {
        this.config = config;
        this.isRunning = false;
        this.intervalId = null;
        this.health = new HealthStatus();

        // Initialize services
        this.ipDetection = new IpDetectionService(config);
        this.gitService = new GitService(config);
        this.telegramService = new TelegramService(config);

        // Debounced IP check to prevent rapid successive calls
        this.debouncedCheck = debounce(
            this.checkAndUpdateIp.bind(this),
            config.rateLimiting.debounceDelay
        );

        logger.info('IP Monitor Service initialized', {
            checkInterval: config.checkInterval,
            gitEnabled: config.git.enabled,
            configPath: config.ipConfigPath
        });
    }

    /**
     * Start the monitoring service
     */
    async start() {
        try {
            if (this.isRunning) {
                logger.warn('Service is already running');
                return false;
            }

            logger.info('Starting IP Monitor Service...');

            // Validate configuration and services
            await this.validateServices();

            // Start Telegram bot
            await this.telegramService.start();

            // Send startup notification
            await this.telegramService.notifyServiceStart();

            // Perform initial IP check
            await this.performInitialCheck();

            // Start periodic monitoring
            this.startPeriodicMonitoring();

            this.isRunning = true;
            this.health.recordCheck(true);

            logger.info('IP Monitor Service started successfully');
            return true;

        } catch (error) {
            logger.error('Failed to start IP Monitor Service:', error);
            this.health.recordCheck(false, error);
            await this.telegramService.notifyError(error, 'Service Startup');
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

            // Stop Telegram bot
            await this.telegramService.stop(reason);

            logger.info('IP Monitor Service stopped successfully');

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

        // Validate Git service
        const gitValidation = await this.gitService.validateService();
        if (!gitValidation.healthy && this.config.git.enabled) {
            throw new Error(`Git service validation failed: ${gitValidation.error}`);
        }

        // Validate IP config file exists
        try {
            await fs.access(this.config.ipConfigPath);
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
            const configDir = path.dirname(this.config.ipConfigPath);
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
                this.config.ipConfigPath,
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

            // Get remote IP from GitHub
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
            await this.telegramService.notifyIpChange(localIp, publicIp);

            // Update local configuration
            await this.updateLocalConfig(publicIp);

            // Commit to Git if enabled
            if (this.config.git.enabled) {
                await this.commitIpChange(publicIp, localIp);
            }

            // Record IP change in health status
            this.health.recordIpChange(localIp, publicIp);
            this.health.recordCheck(true);

            // Send success notification
            await this.telegramService.notifyIpUpdateSuccess(publicIp);

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
            await this.telegramService.notifyError(error, 'IP Check');

            throw error;
        }
    }

    /**
     * Read current IP from local configuration file
     */
    async readLocalIp() {
        try {
            const data = await fs.readFile(this.config.ipConfigPath, 'utf8');
            const config = safeJsonParse(data, {});

            const ip = config['crypto-web-tool'];
            if (!ip || !isValidIp(ip)) {
                throw new Error(`Invalid IP in config file: ${ip}`);
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
            logger.info(`Updating local config with IP: ${newIp}`);

            // Read current config
            let config = {};
            try {
                const data = await fs.readFile(this.config.ipConfigPath, 'utf8');
                config = safeJsonParse(data, {});
            } catch (error) {
                logger.warn('Could not read existing config, creating new one');
            }

            // Update with new IP and metadata
            config['crypto-web-tool'] = newIp;
            config.lastUpdated = formatTimestamp();
            config.updatedBy = 'ip-monitor-service';

            // Write updated config
            await fs.writeFile(
                this.config.ipConfigPath,
                JSON.stringify(config, null, 2),
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
            await this.telegramService.notifyError(error, 'Git Commit');
        }
    }

    /**
     * Get comprehensive service status
     */
    async getStatus() {
        try {
            const healthStatus = this.health.getStatus();
            const ipDetectionStats = this.ipDetection.getStats();
            const gitStatus = await this.gitService.validateService();
            const telegramStats = this.telegramService.getStats();

            const currentIp = await this.readLocalIp();

            return {
                service: {
                    running: this.isRunning,
                    uptime: healthStatus.uptimeMs,
                    checkInterval: this.config.checkInterval,
                    lastCheck: healthStatus.lastCheck,
                    lastSuccess: healthStatus.lastSuccess
                },
                ip: {
                    current: currentIp,
                    lastChange: healthStatus.lastIpChange
                },
                health: {
                    healthy: healthStatus.healthy,
                    errorCount: healthStatus.errorCount,
                    totalChecks: healthStatus.totalChecks,
                    recentErrors: healthStatus.errors.slice(-3)
                },
                services: {
                    ipDetection: ipDetectionStats,
                    git: gitStatus,
                    telegram: telegramStats
                }
            };
        } catch (error) {
            return {
                error: error.message,
                timestamp: formatTimestamp()
            };
        }
    }

    /**
     * Get health check information
     */
    getHealthCheck() {
        const healthStatus = this.health.getStatus();

        return {
            healthy: this.isRunning && healthStatus.healthy,
            uptime: healthStatus.uptimeMs,
            lastCheck: healthStatus.lastCheck,
            errorCount: healthStatus.errorCount,
            services: {
                monitor: this.isRunning,
                git: this.config.git.enabled,
                telegram: true // Assuming it's working if service is running
            }
        };
    }

    /**
     * Force an immediate IP check (for manual triggers)
     */
    async forceCheck() {
        if (!this.isRunning) {
            throw new Error('Service is not running');
        }

        logger.info('Manual IP check triggered');
        return await this.checkAndUpdateIp();
    }
}

module.exports = IpMonitorService;