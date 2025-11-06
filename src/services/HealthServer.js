/**
 * Health monitoring server
 * Provides HTTP endpoints for health checks, status monitoring, and service control
 */

const express = require('express');
const { formatTimestamp } = require('../utils/helpers');
const { logger } = require('../util');

class HealthServer {
    constructor(config, ipMonitorService) {
        this.config = config;
        this.ipMonitorService = ipMonitorService;
        this.app = express();
        this.server = null;
        this.startTime = Date.now();

        this.setupMiddleware();
        this.setupRoutes();
    }

    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        // JSON parsing
        this.app.use(express.json());

        // Request logging
        this.app.use((req, res, next) => {
            logger.info(`${req.method} ${req.path}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            next();
        });

        // CORS headers
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            next();
        });
    }

    /**
     * Setup API routes
     */
    setupRoutes() {
        // Root endpoint
        this.app.get('/', (req, res) => {
            res.json({
                service: 'IP Monitor Service',
                version: '1.0.0',
                timestamp: formatTimestamp(),
                uptime: Date.now() - this.startTime,
                endpoints: {
                    health: '/health',
                    status: '/status',
                    metrics: '/metrics',
                    api: '/api'
                }
            });
        });

        // Health check endpoint
        this.app.get('/health', async (req, res) => {
            try {
                const health = this.ipMonitorService.getHealthCheck();
                const statusCode = health.healthy ? 200 : 503;

                res.status(statusCode).json({
                    status: health.healthy ? 'healthy' : 'unhealthy',
                    timestamp: formatTimestamp(),
                    ...health
                });
            } catch (error) {
                logger.error('Health check failed:', error);
                res.status(503).json({
                    status: 'unhealthy',
                    error: error.message,
                    timestamp: formatTimestamp()
                });
            }
        });

        // Detailed status endpoint
        this.app.get('/status', async (req, res) => {
            try {
                const status = await this.ipMonitorService.getStatus();
                res.json({
                    timestamp: formatTimestamp(),
                    ...status
                });
            } catch (error) {
                logger.error('Status check failed:', error);
                res.status(500).json({
                    error: error.message,
                    timestamp: formatTimestamp()
                });
            }
        });

        // Metrics endpoint (Prometheus-style)
        this.app.get('/metrics', async (req, res) => {
            try {
                const status = await this.ipMonitorService.getStatus();
                const health = this.ipMonitorService.getHealthCheck();

                const metrics = this.formatPrometheusMetrics(status, health);

                res.set('Content-Type', 'text/plain');
                res.send(metrics);
            } catch (error) {
                logger.error('Metrics generation failed:', error);
                res.status(500).json({
                    error: error.message,
                    timestamp: formatTimestamp()
                });
            }
        });

        // API endpoints
        this.setupApiRoutes();

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Endpoint not found',
                method: req.method,
                path: req.originalUrl,
                timestamp: formatTimestamp()
            });
        });

        // Error handler
        this.app.use((error, req, res, next) => {
            logger.error('Express error:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message,
                timestamp: formatTimestamp()
            });
        });
    }

    /**
     * Setup API routes for service control
     */
    setupApiRoutes() {
        const apiRouter = express.Router();

        // Force IP check
        apiRouter.post('/check', async (req, res) => {
            try {
                const result = await this.ipMonitorService.forceCheck();
                res.json({
                    success: true,
                    result,
                    timestamp: formatTimestamp()
                });
            } catch (error) {
                logger.error('Manual IP check failed:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: formatTimestamp()
                });
            }
        });

        // Get current IP
        apiRouter.get('/ip', async (req, res) => {
            try {
                const currentIp = await this.ipMonitorService.readLocalIp();
                res.json({
                    ip: currentIp,
                    timestamp: formatTimestamp()
                });
            } catch (error) {
                logger.error('Failed to get current IP:', error);
                res.status(500).json({
                    error: error.message,
                    timestamp: formatTimestamp()
                });
            }
        });

        // Service control endpoints
        apiRouter.post('/restart', async (req, res) => {
            try {
                logger.info('Service restart requested via API');

                // Stop and start the service
                await this.ipMonitorService.stop('API Restart');
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
                await this.ipMonitorService.start();

                res.json({
                    success: true,
                    message: 'Service restarted successfully',
                    timestamp: formatTimestamp()
                });
            } catch (error) {
                logger.error('Service restart failed:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: formatTimestamp()
                });
            }
        });

        this.app.use('/api', apiRouter);
    }

    /**
     * Format metrics in Prometheus format
     */
    formatPrometheusMetrics(status, health) {
        const metrics = [];

        // Basic service metrics
        metrics.push(`# HELP ip_monitor_up Whether the IP monitor service is running`);
        metrics.push(`# TYPE ip_monitor_up gauge`);
        metrics.push(`ip_monitor_up ${status.service?.running ? 1 : 0}`);

        metrics.push(`# HELP ip_monitor_uptime_seconds Service uptime in seconds`);
        metrics.push(`# TYPE ip_monitor_uptime_seconds counter`);
        metrics.push(`ip_monitor_uptime_seconds ${Math.floor((status.service?.uptime || 0) / 1000)}`);

        // Health metrics
        metrics.push(`# HELP ip_monitor_healthy Whether the service is healthy`);
        metrics.push(`# TYPE ip_monitor_healthy gauge`);
        metrics.push(`ip_monitor_healthy ${health.healthy ? 1 : 0}`);

        metrics.push(`# HELP ip_monitor_errors_total Total number of errors`);
        metrics.push(`# TYPE ip_monitor_errors_total counter`);
        metrics.push(`ip_monitor_errors_total ${status.health?.errorCount || 0}`);

        metrics.push(`# HELP ip_monitor_checks_total Total number of IP checks performed`);
        metrics.push(`# TYPE ip_monitor_checks_total counter`);
        metrics.push(`ip_monitor_checks_total ${status.health?.totalChecks || 0}`);

        // Last check timestamp
        if (status.service?.lastCheck) {
            metrics.push(`# HELP ip_monitor_last_check_timestamp_seconds Timestamp of last IP check`);
            metrics.push(`# TYPE ip_monitor_last_check_timestamp_seconds gauge`);
            metrics.push(`ip_monitor_last_check_timestamp_seconds ${Math.floor(status.service.lastCheck / 1000)}`);
        }

        // Git service status
        if (status.services?.git) {
            metrics.push(`# HELP ip_monitor_git_enabled Whether Git integration is enabled`);
            metrics.push(`# TYPE ip_monitor_git_enabled gauge`);
            metrics.push(`ip_monitor_git_enabled ${status.services.git.enabled ? 1 : 0}`);

            metrics.push(`# HELP ip_monitor_git_healthy Whether Git service is healthy`);
            metrics.push(`# TYPE ip_monitor_git_healthy gauge`);
            metrics.push(`ip_monitor_git_healthy ${status.services.git.healthy ? 1 : 0}`);
        }

        return metrics.join('\n') + '\n';
    }

    /**
     * Start the health server
     */
    async start() {
        if (!this.config.server.enableHealthCheck) {
            logger.info('Health check server is disabled');
            return false;
        }

        try {
            return new Promise((resolve, reject) => {
                this.server = this.app.listen(
                    this.config.server.port,
                    this.config.server.host,
                    () => {
                        const address = this.server.address();
                        logger.info(`Health server started on ${address.address}:${address.port}`);
                        resolve(true);
                    }
                );

                this.server.on('error', (error) => {
                    logger.error('Health server error:', error);
                    reject(error);
                });
            });
        } catch (error) {
            logger.error('Failed to start health server:', error);
            throw error;
        }
    }

    /**
     * Stop the health server
     */
    async stop() {
        if (!this.server) {
            return;
        }

        try {
            return new Promise((resolve) => {
                this.server.close(() => {
                    logger.info('Health server stopped');
                    resolve();
                });
            });
        } catch (error) {
            logger.error('Error stopping health server:', error);
        }
    }

    /**
     * Get server information
     */
    getInfo() {
        if (!this.server) {
            return { running: false };
        }

        const address = this.server.address();
        return {
            running: true,
            host: address.address,
            port: address.port,
            uptime: Date.now() - this.startTime
        };
    }
}

module.exports = HealthServer;