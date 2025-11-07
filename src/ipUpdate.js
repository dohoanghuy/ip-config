/**
 * Simple IP Monitor Application
 * Lightweight version - just IP detection and Git commits
 * 
 * Features:
 * - Multiple IP detection methods with fallbacks
 * - Git integration for automatic commits
 * - Basic health monitoring endpoint
 * - Graceful shutdown handling
 * - Simple logging
 */

require('dotenv').config();

const path = require('path');
const { logger } = require('./util');

// Import core components
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

            // Initialize Health Server (optional)
            if (this.config.server.enableHealthCheck) {
                this.healthServer = new HealthServer(this.config, this.ipMonitorService);
            }

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

            // Start health server first (if enabled)
            if (this.healthServer) {
                await this.healthServer.start();
                const serverInfo = this.healthServer.getInfo();
                logger.info(`Health server started on ${serverInfo.host}:${serverInfo.port}`);
                logger.info(`Health server available at http://${serverInfo.host}:${serverInfo.port}`);
            }

            // Start IP Monitor Service
            await this.ipMonitorService.start();

            logger.info('🚀 IP Monitor Application started successfully!');
            logger.info(`📊 Monitoring interval: ${Math.round(this.config.checkInterval / 60000)} minutes`);
            logger.info(`🔧 Git integration: ${this.config.git.enabled ? 'Enabled' : 'Disabled'}`);

            if (this.healthServer) {
                logger.info(`🏥 Health endpoint: http://localhost:${this.config.server.port}/health`);
            }

            logger.info('Application startup completed. Press Ctrl+C to stop.');

            return true;

        } catch (error) {
            logger.error('Application startup failed:', error);
            throw error;
        }
    }

    /**
     * Stop the application
     */
    async stop(reason = 'Manual') {
        if (this.isShuttingDown) {
            logger.warn('Shutdown already in progress...');
            return;
        }

        try {
            this.isShuttingDown = true;
            logger.info(`🛑 Shutting down IP Monitor Application: ${reason}`);

            // Stop IP Monitor Service
            if (this.ipMonitorService) {
                await this.ipMonitorService.stop(reason);
                logger.info('IP Monitor Service stopped');
            }

            // Stop Health Server
            if (this.healthServer) {
                await this.healthServer.stop();
                logger.info('Health Server stopped');
            }

            logger.info('✅ Application shutdown completed gracefully');

        } catch (error) {
            logger.error('Error during application shutdown:', error);
        }
    }

    /**
     * Setup process signal handlers
     */
    setupProcessHandlers() {
        // Handle process termination signals
        const signals = ['SIGINT', 'SIGTERM', 'SIGUSR2'];

        signals.forEach(signal => {
            process.on(signal, async () => {
                logger.info(`Received ${signal}: ${this.getSignalDescription(signal)}`);
                await this.stop(this.getSignalDescription(signal));
                process.exit(0);
            });
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', async (error) => {
            logger.error('Uncaught Exception:', error);
            await this.stop('Uncaught Exception');
            process.exit(1);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', async (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
            await this.stop('Unhandled Rejection');
            process.exit(1);
        });
    }

    /**
     * Get human-readable description for process signals
     */
    getSignalDescription(signal) {
        const descriptions = {
            'SIGINT': 'Interrupt Signal (Ctrl+C)',
            'SIGTERM': 'Termination Signal',
            'SIGUSR2': 'User Signal 2 (nodemon restart)'
        };
        return descriptions[signal] || signal;
    }

    /**
     * Get application status
     */
    async getStatus() {
        if (!this.ipMonitorService) {
            return {
                status: 'not_initialized',
                timestamp: new Date().toISOString()
            };
        }

        return await this.ipMonitorService.getStatus();
    }
}

// Create and run the application
async function main() {
    const app = new Application();

    try {
        await app.initialize();
        await app.start();
    } catch (error) {
        logger.error('Failed to start application:', error);
        process.exit(1);
    }
}

// Start the application
if (require.main === module) {
    main().catch(error => {
        console.error('Application crashed:', error);
        process.exit(1);
    });
}

module.exports = Application;