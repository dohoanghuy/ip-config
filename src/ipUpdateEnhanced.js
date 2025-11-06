/**
 * Enhanced IP Monitor Application
 * Main entry point with improved architecture, error handling, and monitoring
 * 
 * Features:
 * - Multiple IP detection methods with fallbacks
 * - Robust error handling and retry mechanisms
 * - Rate-limited Telegram notifications
 * - Git integration with rollback capabilities
 * - Health monitoring and status endpoints
 * - Graceful shutdown handling
 * - Comprehensive logging
 */

require('dotenv').config();

const path = require('path');
const { logger } = require('./util');

// Import new architecture components
const Config = require('./config/Config');
const IpMonitorService = require('./services/IpMonitorService');
const HealthServer = require('./services/HealthServer');

class Application {
    constructor() {
        this.config = null;
        this.ipMonitorService = null;
        this.healthServer = null;
        this.isShuttingDown = false;

        // Setup process handlers
        this.setupProcessHandlers();
    }

    /**
     * Initialize the application
     */
    async initialize() {
        try {
            logger.info('Initializing IP Monitor Application...');

            // Load and validate configuration
            this.config = new Config();
            logger.info('Configuration loaded successfully');

            if (this.config.isDevelopment()) {
                logger.info('Running in development mode');
                logger.info('Configuration:', this.config.toString());
            }

            // Initialize IP Monitor Service
            this.ipMonitorService = new IpMonitorService(this.config);

            // Initialize Health Server
            this.healthServer = new HealthServer(this.config, this.ipMonitorService);

            logger.info('Application initialized successfully');

        } catch (error) {
            logger.error('Application initialization failed:', error);
            throw error;
        }
    }

    /**
     * Start the application
     */
    async start() {
        try {
            if (!this.config || !this.ipMonitorService) {
                throw new Error('Application not initialized. Call initialize() first.');
            }

            logger.info('Starting IP Monitor Application...');

            // Start health server first
            if (this.config.server.enableHealthCheck) {
                await this.healthServer.start();
                const serverInfo = this.healthServer.getInfo();
                logger.info(`Health server available at http://${serverInfo.host}:${serverInfo.port}`);
            }

            // Start IP monitoring service
            await this.ipMonitorService.start();

            logger.info('🚀 IP Monitor Application started successfully!');
            logger.info(`📊 Monitoring interval: ${Math.round(this.config.checkInterval / 60000)} minutes`);
            logger.info(`🔧 Git integration: ${this.config.git.enabled ? 'Enabled' : 'Disabled'}`);
            logger.info(`💬 Telegram notifications: Enabled (Chat: ${this.config.telegramChatId})`);

            if (this.config.server.enableHealthCheck) {
                const serverInfo = this.healthServer.getInfo();
                logger.info(`🏥 Health endpoint: http://localhost:${serverInfo.port}/health`);
            }

            // Log startup completion
            logger.info('Application startup completed. Press Ctrl+C to stop.');

        } catch (error) {
            logger.error('Application startup failed:', error);
            await this.shutdown('Startup Failure');
            process.exit(1);
        }
    }

    /**
     * Shutdown the application gracefully
     */
    async shutdown(reason = 'Manual') {
        if (this.isShuttingDown) {
            logger.warn('Shutdown already in progress...');
            return;
        }

        this.isShuttingDown = true;
        logger.info(`🛑 Shutting down IP Monitor Application: ${reason}`);

        try {
            // Stop IP monitoring service
            if (this.ipMonitorService) {
                await this.ipMonitorService.stop(reason);
                logger.info('IP Monitor Service stopped');
            }

            // Stop health server
            if (this.healthServer) {
                await this.healthServer.stop();
                logger.info('Health Server stopped');
            }

            logger.info('✅ Application shutdown completed gracefully');

        } catch (error) {
            logger.error('Error during shutdown:', error);
        }

        // Give some time for final log entries
        setTimeout(() => {
            process.exit(0);
        }, 1000);
    }

    /**
     * Setup process signal handlers for graceful shutdown
     */
    setupProcessHandlers() {
        // Handle process termination signals
        const signalHandlers = {
            'SIGINT': 'Interrupt Signal (Ctrl+C)',
            'SIGTERM': 'Termination Signal',
            'SIGUSR1': 'User Signal 1',
            'SIGUSR2': 'User Signal 2'
        };

        Object.entries(signalHandlers).forEach(([signal, description]) => {
            process.on(signal, async () => {
                logger.info(`Received ${signal}: ${description}`);
                await this.shutdown(description);
            });
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
            this.shutdown('Uncaught Exception').then(() => {
                process.exit(1);
            });
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
            this.shutdown('Unhandled Promise Rejection').then(() => {
                process.exit(1);
            });
        });

        // Handle warnings
        process.on('warning', (warning) => {
            logger.warn('Process Warning:', {
                name: warning.name,
                message: warning.message,
                stack: warning.stack
            });
        });
    }

    /**
     * Get application status
     */
    async getStatus() {
        if (!this.ipMonitorService) {
            return { status: 'not-initialized' };
        }

        try {
            const serviceStatus = await this.ipMonitorService.getStatus();
            const healthServerInfo = this.healthServer ? this.healthServer.getInfo() : { running: false };

            return {
                status: 'running',
                application: {
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    pid: process.pid,
                    version: process.version,
                    platform: process.platform
                },
                services: {
                    ipMonitor: serviceStatus,
                    healthServer: healthServerInfo
                },
                config: {
                    environment: process.env.NODE_ENV || 'development',
                    checkInterval: this.config.checkInterval,
                    gitEnabled: this.config.git.enabled
                }
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message
            };
        }
    }
}

/**
 * Main application entry point
 */
async function main() {
    const app = new Application();

    try {
        // Initialize and start the application
        await app.initialize();
        await app.start();

        // Keep the process running
        // The application will handle shutdown via signal handlers

    } catch (error) {
        logger.error('Failed to start application:', error);
        process.exit(1);
    }
}

// Export for potential testing or programmatic use
module.exports = { Application, main };

// Run the application if this file is executed directly
if (require.main === module) {
    main().catch((error) => {
        console.error('Fatal application error:', error);
        process.exit(1);
    });
}