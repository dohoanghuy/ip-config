# IP Monitor Service 🌐

An enhanced, production-ready IP monitoring service with automatic updates, Telegram notifications, and Git integration.

## 🚀 Features

### 🔍 **Robust IP Detection**
- Multiple IP detection methods with automatic failover
- Supports Google DNS, IPify, AWS CheckIP, HTTPBin, and ICanHazIP
- IP address validation and format checking
- Configurable timeouts and retry mechanisms

### 📱 **Telegram Integration**
- Real-time IP change notifications
- Interactive bot commands (`/ip`, `/status`, `/health`)
- Rate limiting to prevent spam
- Queue system for message reliability
- HTML formatted messages with proper error handling

### 🔄 **Git Automation**
- Automatic commits when IP changes
- Rollback capabilities on failures
- Retry mechanisms with exponential backoff
- Configurable auto-commit settings
- Remote repository synchronization

### 📊 **Health Monitoring**
- HTTP health check endpoints
- Prometheus-style metrics
- Service status monitoring
- Error tracking and reporting
- Uptime statistics

### ⚙️ **Production Ready**
- Comprehensive error handling
- Graceful shutdown mechanisms
- Structured logging
- Environment-based configuration
- Rate limiting and debouncing
- Memory and performance optimized

## 📦 Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/dohoanghuy/ip-config.git
   cd ip-config
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Set up Telegram bot:**
   - Create a bot via [@BotFather](https://t.me/BotFather)
   - Get your chat ID from [@userinfobot](https://t.me/userinfobot)
   - Add credentials to `.env`

## ⚙️ Configuration

### Required Environment Variables

```bash
# Telegram Configuration
TELEGRAM_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

### Optional Configuration

```bash
# Monitoring Settings
CHECK_INTERVAL_MS=3600000          # 1 hour
IP_CHECK_TIMEOUT=30000             # 30 seconds
MAX_RETRIES=3                      # Retry attempts

# Git Settings  
GIT_COMMIT_ENABLED=true            # Enable Git integration
GIT_AUTO_COMMIT=true               # Auto-commit changes
GIT_MAX_RETRIES=3                  # Git operation retries

# Server Settings
PORT=3000                          # Health server port
HEALTH_CHECK=true                  # Enable health endpoints

# Rate Limiting
MAX_NOTIFICATIONS_PER_WINDOW=5     # Max notifications per minute
DEBOUNCE_DELAY=5000                # Debounce IP checks (5s)
```

## 🚀 Usage

### Start the Service

```bash
# Production mode
npm start

# Development mode (with auto-restart)
npm run dev

# Legacy version
npm run ip
```

### Available Commands

```bash
# Check service health
npm run health

# Get detailed status  
npm run status

# Force immediate IP check
npm run force-check
```

### Telegram Bot Commands

- `/ip` - Show current IP address
- `/status` - Service status and statistics  
- `/health` - Health check information
- `/help` - Show available commands

## 🏥 Health Monitoring

### HTTP Endpoints

- `GET /health` - Basic health check
- `GET /status` - Detailed service status
- `GET /metrics` - Prometheus metrics
- `POST /api/check` - Force IP check
- `GET /api/ip` - Get current IP

### Health Check Response

```json
{
  "status": "healthy",
  "healthy": true,
  "uptime": 3661000,
  "lastCheck": 1699123456789,
  "errorCount": 0,
  "services": {
    "monitor": true,
    "git": true,
    "telegram": true
  }
}
```

## 🔧 Architecture

### Service Components

- **IpMonitorService** - Main orchestration service
- **IpDetectionService** - Multiple IP detection methods
- **GitService** - Git operations with retry logic
- **TelegramService** - Bot and notification handling
- **HealthServer** - HTTP monitoring endpoints

### Configuration Management

- **Config** - Centralized configuration with validation
- **Environment validation** - Required variable checking
- **Default values** - Sensible production defaults

### Utilities

- **Rate limiting** - Prevent notification spam
- **Debouncing** - Avoid rapid successive checks
- **Retry mechanisms** - Exponential backoff strategies
- **Health tracking** - Service status monitoring

## 📈 Monitoring & Metrics

### Prometheus Metrics

```bash
curl http://localhost:3000/metrics
```

Available metrics:
- `ip_monitor_up` - Service running status
- `ip_monitor_healthy` - Health check status
- `ip_monitor_uptime_seconds` - Service uptime
- `ip_monitor_errors_total` - Total error count
- `ip_monitor_checks_total` - Total IP checks performed

### Log Output

Structured JSON logging with different levels:
- `info` - Normal operations
- `warn` - Warning conditions  
- `error` - Error conditions
- `debug` - Debug information (dev mode)

## 🔒 Security Features

- Input sanitization for git commits
- Environment variable validation
- Rate limiting for notifications
- IP address format validation
- Error message sanitization

## 🐳 Docker Support

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 3000

USER node
CMD ["npm", "start"]
```

## 🔄 Migration from Legacy

To upgrade from the old `ipUpdate.js`:

1. Install new dependencies: `npm install express`
2. Copy configuration: `cp .env.example .env`
3. Update environment variables
4. Test with: `npm run ip:enhanced`
5. Switch to production: `npm start`

## 🚨 Troubleshooting

### Common Issues

**Service won't start:**
- Check required environment variables
- Verify Telegram token and chat ID
- Ensure Git repository is properly configured

**IP detection failing:**
- Check internet connectivity
- Verify DNS resolution
- Review firewall settings

**Git operations failing:**
- Verify Git credentials
- Check repository permissions
- Ensure working directory is clean

### Debug Mode

```bash
LOG_LEVEL=debug npm run dev
```

## 📊 Performance

### System Requirements
- Node.js 14+
- 50MB RAM
- Minimal CPU usage
- Network connectivity

### Optimizations
- Debounced IP checks
- Rate-limited notifications  
- Efficient memory usage
- Minimal dependency footprint

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- 🐛 **Issues**: [GitHub Issues](https://github.com/dohoanghuy/ip-config/issues)
- 💬 **Telegram**: Contact via the configured bot
- 📧 **Email**: Check repository owner

---

**Enhanced IP Monitor Service v2.0** - Production-ready IP monitoring with enterprise features.