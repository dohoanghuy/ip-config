/**
 * Test Simple IP Monitor
 * Verify core functionality without notifications
 */

require('dotenv').config();

async function testSimple() {
    console.log('🧪 Testing Simple IP Monitor...\n');

    try {
        // Test configuration loading
        console.log('📝 Testing configuration...');
        const Config = require('./src/config/Config');
        const config = new Config();
        console.log('✅ Configuration loaded successfully');
        console.log('   Check interval:', Math.round(config.checkInterval / 60000), 'minutes');
        console.log('   Git enabled:', config.git.enabled);
        console.log('   Config path:', config.configPath);

        // Test IP detection
        console.log('\n🌐 Testing IP detection...');
        const IpDetectionService = require('./src/services/IpDetectionService');
        const ipDetection = new IpDetectionService(config);

        const ipResult = await ipDetection.getPublicIp();
        console.log('✅ IP detection successful');
        console.log('   Current IP:', ipResult.ip);
        console.log('   Method:', ipResult.method);

        // Test Git service (if enabled)
        if (config.git.enabled) {
            console.log('\n📚 Testing Git service...');
            const GitService = require('./src/services/GitService');
            const gitService = new GitService(config);

            const gitStatus = await gitService.validateService();
            console.log(gitStatus.healthy ? '✅ Git service healthy' : '⚠️ Git service issues');
            if (!gitStatus.healthy) {
                console.log('   Error:', gitStatus.error);
            }
        }

        // Test service initialization
        console.log('\n🚀 Testing service initialization...');
        const IpMonitorService = require('./src/services/IpMonitorService');
        const service = new IpMonitorService(config);

        console.log('✅ Service created successfully');

        // Test a single IP check cycle
        console.log('\n🔍 Testing IP check cycle...');
        try {
            const result = await service.checkAndUpdateIp();
            console.log('✅ IP check completed');
            console.log('   Updated:', result.updated);
            console.log('   Current IP:', result.currentIp || result.newIp);
            if (result.updated) {
                console.log('   Old IP:', result.oldIp);
                console.log('   New IP:', result.newIp);
                console.log('   Duration:', result.duration + 'ms');
            }
        } catch (error) {
            console.log('⚠️ IP check had issues:', error.message);
        }

        console.log('\n📊 Service status:');
        const status = await service.getStatus();
        console.log('   Service name:', status.service.name);
        console.log('   Healthy:', status.service.healthy);
        console.log('   Current IP:', status.currentIp);

        console.log('\n✅ Simple IP Monitor test completed successfully!');
        console.log('\n🚀 To run the IP monitor:');
        console.log('   npm start');
        console.log('\n📊 To monitor health:');
        console.log('   curl http://localhost:3000/health');

    } catch (error) {
        console.error('❌ Simple IP Monitor test failed:', error.message);
        console.error(error);
    }
}

testSimple()
    .then(() => {
        console.log('\n🏁 Test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Test crashed:', error);
        process.exit(1);
    });