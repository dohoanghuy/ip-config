# Simple IP Monitor

A lightweight version of the IP monitoring service that focuses on core functionality only:
- **IP Detection** with multiple fallback methods
- **Git Integration** for automatic commits
- **Basic Health Monitoring** endpoint
- **No Notifications** - clean and simple

## Features

✅ **Multiple IP Detection Methods**
- Google DNS (8.8.8.8)  
- Cloudflare DNS (1.1.1.1)
- httpbin.org API
- ipify.org API

✅ **Automatic Git Commits**
- Detects IP changes
- Updates local config file
- Commits changes to repository
- Rollback capability on errors

✅ **Health Monitoring**
- Simple HTTP health endpoint
- Service status reporting
- Basic statistics tracking

❌ **Removed Complexity**
- No Telegram notifications
- No Discord integration
- No rate limiting complexity
- No message queuing
- No fallback notification systems

## Quick Start

### 1. Configuration

Copy the simple environment template:
```bash
cp .env.simple .env
```

Edit `.env` with your settings:
```bash
# Monitoring interval (1 hour)
CHECK_INTERVAL_MS=3600000

# Git settings
GIT_COMMIT_ENABLED=true
GITHUB_OWNER=your_username
GITHUB_REPO=your_repo

# Optional health endpoint
HEALTH_CHECK=true
PORT=3000
```

### 2. Run Simple Version

```bash
# Test the configuration
node test-simple.js

# Run the simple monitor
npm run start:simple

# Development mode with auto-restart
npm run dev:simple
```

### 3. Monitor Health

```bash
# Check service health
curl http://localhost:3000/health

# Get detailed status
curl http://localhost:3000/status
```

## How It Works

1. **Periodic Checks**: Service runs every hour (configurable)
2. **IP Detection**: Tries multiple methods to get current public IP
3. **Comparison**: Compares local config vs current IP vs remote GitHub IP  
4. **Update**: If different, updates local config file
5. **Git Commit**: Automatically commits IP changes to repository
6. **Health**: Provides simple HTTP endpoint for monitoring

## File Structure

```
src/
├── ipUpdateSimple.js           # Simple main application
├── config/
│   └── SimpleConfig.js         # Simplified configuration
├── services/
│   ├── SimpleIpMonitorService.js  # Core monitoring logic
│   ├── IpDetectionService.js      # IP detection methods
│   ├── GitService.js              # Git operations
│   └── HealthServer.js            # Health endpoint
└── config/
    └── ip.json                    # IP storage file
```

## Configuration Options

| Variable             | Default    | Description              |
| -------------------- | ---------- | ------------------------ |
| `CHECK_INTERVAL_MS`  | 3600000    | Check frequency (1 hour) |
| `GIT_COMMIT_ENABLED` | true       | Enable Git commits       |
| `GITHUB_OWNER`       | dohoanghuy | GitHub username          |
| `GITHUB_REPO`        | ip-config  | Repository name          |
| `HEALTH_CHECK`       | true       | Enable health endpoint   |
| `PORT`               | 3000       | Health server port       |
| `LOG_LEVEL`          | info       | Logging level            |

## Health Endpoint Response

```json
{
  "status": "healthy",
  "timestamp": "2025-11-07T10:30:00.000Z",
  "healthy": true,
  "uptime": 3600000,
  "lastCheck": 1730976600000,
  "errorCount": 0,
  "services": {
    "monitor": true,
    "git": true
  }
}
```

## Benefits of Simple Version

- **Faster startup** - No notification service initialization
- **Lower memory usage** - Minimal dependencies
- **Easier debugging** - Less complexity
- **Fewer dependencies** - No Telegram/Discord libraries needed
- **Simpler configuration** - No notification tokens required
- **Focus on core functionality** - Just IP detection and Git commits

## Migration

To switch from the enhanced version to simple:

```bash
# Backup your current .env
cp .env .env.backup

# Use simple configuration
cp .env.simple .env

# Run simple version
npm run start:simple
```

To switch back to enhanced version:
```bash
# Restore full configuration  
cp .env.backup .env

# Run enhanced version
npm run start
```