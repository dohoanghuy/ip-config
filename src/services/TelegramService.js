/**
 * Enhanced Telegram Service with rate limiting and better command handling
 * Provides reliable messaging with retry mechanisms and notification management
 */

const { Telegraf } = require('telegraf');
const { RateLimiter, withRetry, formatTimestamp } = require('../utils/helpers');
const { logger } = require('../util');

class TelegramService {
    constructor(config) {
        this.config = config;
        this.bot = new Telegraf(config.telegramToken);
        this.chatId = config.telegramChatId;
        this.timeout = config.telegram.timeout;
        this.retryAttempts = config.telegram.retryAttempts;

        // Rate limiting for notifications
        this.rateLimiter = new RateLimiter(
            config.rateLimiting.maxNotifications,
            config.rateLimiting.notificationWindow
        );

        // HTML options for message formatting
        this.htmlOptions = {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        };

        this.setupBotHandlers();
        this.messageQueue = [];
        this.isProcessingQueue = false;
    }

    /**
     * Setup bot command handlers
     */
    setupBotHandlers() {
        // Start command
        this.bot.start(async (ctx) => {
            const welcomeMessage = `
🤖 <b>IP Monitor Bot</b>

Available commands:
/ip - Get current IP address
/status - Get service status
/health - Get health check
/stats - Get statistics
/help - Show this help message

Bot is monitoring IP changes automatically.
`;
            await ctx.reply(welcomeMessage, this.htmlOptions);
        });

        // IP command
        this.bot.command('ip', async (ctx) => {
            try {
                const ipData = await this.getCurrentIp();
                const message = `🌐 <b>Current IP Address:</b>\n<code>${ipData.ip}</code>`;
                await ctx.reply(message, this.htmlOptions);
            } catch (error) {
                logger.error('Failed to get IP for command:', error);
                await ctx.reply('❌ Failed to retrieve current IP address');
            }
        });

        // Status command
        this.bot.command('status', async (ctx) => {
            try {
                const status = await this.getServiceStatus();
                await ctx.reply(status, this.htmlOptions);
            } catch (error) {
                logger.error('Failed to get status:', error);
                await ctx.reply('❌ Failed to retrieve service status');
            }
        });

        // Health command
        this.bot.command('health', async (ctx) => {
            try {
                const health = await this.getHealthStatus();
                await ctx.reply(health, this.htmlOptions);
            } catch (error) {
                logger.error('Failed to get health status:', error);
                await ctx.reply('❌ Failed to retrieve health status');
            }
        });

        // Help command
        this.bot.help((ctx) => {
            const helpMessage = `
📖 <b>Help - IP Monitor Bot</b>

<b>Commands:</b>
/ip - Show current public IP address
/status - Show service status and statistics
/health - Show health check information
/stats - Show detailed statistics
/help - Show this help message

<b>Notifications:</b>
• IP change alerts
• Service status updates
• Error notifications (rate limited)

<b>Features:</b>
• Automatic IP monitoring
• Multiple IP detection methods
• Git integration for IP history
• Health monitoring and alerts
`;
            return ctx.reply(helpMessage, this.htmlOptions);
        });

        // Error handling
        this.bot.catch((error, ctx) => {
            logger.error(`Telegram bot error for ${ctx.updateType}:`, error);
            const errorMessage = `❌ Bot error occurred: ${error.message}`;
            this.sendNotification(errorMessage, 'error');
        });

        logger.info('Telegram bot handlers setup completed');
    }

    /**
     * Send notification with rate limiting and retry
     */
    async sendNotification(message, type = 'info', priority = 'normal') {
        // Check rate limiting for non-critical messages
        if (priority !== 'critical' && !this.rateLimiter.isAllowed()) {
            logger.warn('Notification rate limit exceeded, message queued');
            this.messageQueue.push({ message, type, priority, timestamp: Date.now() });
            return false;
        }

        try {
            const formattedMessage = this.formatMessage(message, type);

            await withRetry(
                () => this.bot.telegram.sendMessage(this.chatId, formattedMessage, this.htmlOptions),
                this.retryAttempts,
                1000
            );

            logger.info(`Telegram notification sent: ${type}`);
            return true;

        } catch (error) {
            logger.error('Failed to send Telegram notification:', error);

            // Queue critical messages for retry
            if (priority === 'critical') {
                this.messageQueue.push({ message, type, priority, timestamp: Date.now() });
            }

            return false;
        }
    }

    /**
     * Format message based on type
     */
    formatMessage(message, type) {
        const timestamp = formatTimestamp();
        const typeEmojis = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            critical: '🚨',
            ip_change: '🌐'
        };

        const emoji = typeEmojis[type] || 'ℹ️';
        return `${emoji} <b>${timestamp}</b>\n${message}`;
    }

    /**
     * Send IP change notification
     */
    async notifyIpChange(oldIp, newIp) {
        const message = `<b>IP Address Changed!</b>\n\n` +
            `Old IP: <code>${oldIp}</code>\n` +
            `New IP: <code>${newIp}</code>`;

        return await this.sendNotification(message, 'ip_change', 'critical');
    }

    /**
     * Send IP update success notification
     */
    async notifyIpUpdateSuccess(ip) {
        const message = `<b>IP Update Completed</b>\n\n` +
            `New IP: <code>${ip}</code>\n` +
            `✅ File updated\n` +
            `✅ Git committed\n` +
            `✅ Changes pushed`;

        return await this.sendNotification(message, 'success', 'normal');
    }

    /**
     * Send error notification
     */
    async notifyError(error, context = '') {
        const message = `<b>Service Error${context ? ` - ${context}` : ''}</b>\n\n` +
            `Error: <code>${error.message}</code>`;

        return await this.sendNotification(message, 'error', 'normal');
    }

    /**
     * Send service startup notification
     */
    async notifyServiceStart() {
        const message = `<b>IP Monitor Service Started</b>\n\n` +
            `🚀 Service is now running\n` +
            `📍 Monitoring interval: ${Math.round(this.config.checkInterval / 60000)} minutes\n` +
            `🔧 Git integration: ${this.config.git.enabled ? 'Enabled' : 'Disabled'}`;

        return await this.sendNotification(message, 'success', 'normal');
    }

    /**
     * Process message queue
     */
    async processMessageQueue() {
        if (this.isProcessingQueue || this.messageQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        try {
            // Process critical messages first
            const criticalMessages = this.messageQueue.filter(msg => msg.priority === 'critical');
            const normalMessages = this.messageQueue.filter(msg => msg.priority !== 'critical');

            const sortedMessages = [...criticalMessages, ...normalMessages];

            for (const msg of sortedMessages.slice(0, 3)) { // Process max 3 messages
                await this.sendNotification(msg.message, msg.type, msg.priority);

                // Remove processed message
                const index = this.messageQueue.findIndex(m =>
                    m.message === msg.message && m.timestamp === msg.timestamp
                );
                if (index > -1) {
                    this.messageQueue.splice(index, 1);
                }
            }
        } catch (error) {
            logger.error('Error processing message queue:', error);
        } finally {
            this.isProcessingQueue = false;
        }
    }

    /**
     * Get current IP (placeholder - should be injected from main service)
     */
    async getCurrentIp() {
        // This should be replaced with actual IP detection service
        const fs = require('fs').promises;
        try {
            const data = await fs.readFile(this.config.ipConfigPath, 'utf8');
            const ipData = JSON.parse(data);
            return { ip: ipData['crypto-web-tool'] };
        } catch (error) {
            throw new Error('Failed to read IP configuration');
        }
    }

    /**
     * Get service status (placeholder)
     */
    async getServiceStatus() {
        return `📊 <b>Service Status</b>\n\n` +
            `Status: ✅ Running\n` +
            `Uptime: ${process.uptime().toFixed(0)} seconds\n` +
            `Rate Limit: ${this.rateLimiter.getStatus().remaining} remaining`;
    }

    /**
     * Get health status (placeholder)
     */
    async getHealthStatus() {
        return `🏥 <b>Health Check</b>\n\n` +
            `Service: ✅ Healthy\n` +
            `Telegram: ✅ Connected\n` +
            `Queue: ${this.messageQueue.length} messages`;
    }

    /**
     * Start the bot
     */
    async start() {
        try {
            await this.bot.launch();
            logger.info('Telegram bot started successfully');

            // Start queue processing
            setInterval(() => this.processMessageQueue(), 30000); // Every 30 seconds

            // Setup graceful shutdown
            process.once('SIGINT', () => this.stop('SIGINT'));
            process.once('SIGTERM', () => this.stop('SIGTERM'));

            return true;
        } catch (error) {
            logger.error('Failed to start Telegram bot:', error);
            throw error;
        }
    }

    /**
     * Stop the bot
     */
    async stop(reason = 'Manual') {
        try {
            logger.info(`Stopping Telegram bot: ${reason}`);
            this.bot.stop(reason);
            logger.info('Telegram bot stopped successfully');
        } catch (error) {
            logger.error('Error stopping Telegram bot:', error);
        }
    }

    /**
     * Get service statistics
     */
    getStats() {
        return {
            rateLimiter: this.rateLimiter.getStatus(),
            messageQueue: {
                length: this.messageQueue.length,
                criticalCount: this.messageQueue.filter(m => m.priority === 'critical').length
            },
            config: {
                chatId: this.chatId,
                timeout: this.timeout,
                retryAttempts: this.retryAttempts
            }
        };
    }

    /**
     * Reset rate limiter (for testing or manual reset)
     */
    resetRateLimiter() {
        this.rateLimiter.reset();
        logger.info('Telegram rate limiter reset');
    }
}

module.exports = TelegramService;