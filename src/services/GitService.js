/**
 * Git Service for handling repository operations
 * Includes retry mechanisms, proper error handling, and rollback capabilities
 */

const { executeCommand, sanitizeGitMessage, withRetry, sleep } = require('../utils/helpers');
const { logger } = require('../util');

class GitService {
    constructor(config) {
        this.config = config;
        this.enabled = config.git.enabled;
        this.maxRetries = config.git.maxRetries;
        this.timeout = config.git.timeout;
        this.autoCommit = config.git.autoCommit;
    }

    /**
     * Check if git operations are enabled
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * Check git repository status
     */
    async getStatus() {
        try {
            const status = await executeCommand('git status --porcelain', {
                timeout: this.timeout
            });

            const branch = await executeCommand('git branch --show-current', {
                timeout: this.timeout
            });

            return {
                hasChanges: status.trim().length > 0,
                changes: status.trim().split('\n').filter(line => line.trim()),
                currentBranch: branch.trim(),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            throw new Error(`Failed to get git status: ${error.message}`);
        }
    }

    /**
     * Pull latest changes from remote
     */
    async pull() {
        try {
            logger.info('Pulling latest changes from remote repository');
            const result = await executeCommand('git pull', {
                timeout: this.timeout
            });

            logger.info('Git pull completed successfully');
            return result;
        } catch (error) {
            throw new Error(`Git pull failed: ${error.message}`);
        }
    }

    /**
     * Add files to staging area
     */
    async add(files = []) {
        try {
            const filesToAdd = files.length > 0 ? files.join(' ') : '.';
            const command = `git add ${filesToAdd}`;

            logger.info(`Adding files to git: ${filesToAdd}`);
            const result = await executeCommand(command, {
                timeout: this.timeout
            });

            logger.info('Files added to git staging area');
            return result;
        } catch (error) {
            throw new Error(`Git add failed: ${error.message}`);
        }
    }

    /**
     * Commit changes with message
     */
    async commit(message, files = []) {
        try {
            const sanitizedMessage = sanitizeGitMessage(message);
            if (!sanitizedMessage) {
                throw new Error('Invalid commit message');
            }

            // Add files if specified
            if (files.length > 0) {
                await this.add(files);
            }

            const command = `git commit -m "${sanitizedMessage}"`;
            logger.info(`Committing changes: ${sanitizedMessage}`);

            const result = await executeCommand(command, {
                timeout: this.timeout
            });

            logger.info('Git commit completed successfully');
            return result;
        } catch (error) {
            // Check if it's a "nothing to commit" error (not actually an error)
            if (error.message.includes('nothing to commit') ||
                error.message.includes('no changes added')) {
                logger.info('No changes to commit');
                return 'No changes to commit';
            }
            throw new Error(`Git commit failed: ${error.message}`);
        }
    }

    /**
     * Push changes to remote repository
     */
    async push() {
        try {
            logger.info('Pushing changes to remote repository');
            const result = await executeCommand('git push', {
                timeout: this.timeout
            });

            logger.info('Git push completed successfully');
            return result;
        } catch (error) {
            throw new Error(`Git push failed: ${error.message}`);
        }
    }

    /**
     * Complete git workflow: pull, add, commit, push
     */
    async commitAndPush(message, files = []) {
        if (!this.enabled) {
            logger.info('Git operations are disabled');
            return { success: true, message: 'Git operations disabled' };
        }

        const operations = [];

        try {
            // Step 1: Pull latest changes
            operations.push('pull');
            await this.pull();

            // Step 2: Check if there are changes to commit
            const status = await this.getStatus();
            if (!status.hasChanges && files.length === 0) {
                logger.info('No changes detected, skipping commit');
                return { success: true, message: 'No changes to commit' };
            }

            // Step 3: Add files
            operations.push('add');
            await this.add(files);

            // Step 4: Commit changes
            operations.push('commit');
            await this.commit(message, []);

            // Step 5: Push to remote
            operations.push('push');
            await this.push();

            return {
                success: true,
                message: `Git operations completed: ${operations.join(' -> ')}`,
                operations: operations
            };

        } catch (error) {
            logger.error(`Git operation failed at step '${operations[operations.length - 1]}':`, error);

            // Attempt rollback if commit succeeded but push failed
            if (operations.includes('commit') && !operations.includes('push')) {
                await this.attemptRollback();
            }

            throw new Error(`Git operations failed at ${operations[operations.length - 1]}: ${error.message}`);
        }
    }

    /**
     * Commit IP change with retry mechanism
     */
    async commitIpChange(ip, oldIp = null) {
        if (!this.enabled || !this.autoCommit) {
            logger.info('Auto-commit is disabled');
            return { success: true, message: 'Auto-commit disabled' };
        }

        const message = oldIp ?
            `update ip ${oldIp} -> ${ip}` :
            `update ip ${ip}`;

        try {
            logger.info(`Committing IP change: ${message}`);

            const result = await withRetry(
                () => this.commitAndPush(message, ['src/config/ip.json']),
                this.maxRetries,
                2000 // 2 second base delay
            );

            logger.info('IP change committed successfully');
            return result;

        } catch (error) {
            logger.error('Failed to commit IP change after retries:', error);
            throw new Error(`Failed to commit IP change: ${error.message}`);
        }
    }

    /**
     * Attempt to rollback last commit
     */
    async attemptRollback() {
        try {
            logger.warn('Attempting to rollback last commit');
            await executeCommand('git reset --soft HEAD~1', {
                timeout: this.timeout
            });
            logger.info('Rollback completed successfully');
        } catch (rollbackError) {
            logger.error('Rollback failed:', rollbackError);
            // Don't throw here as it's a recovery attempt
        }
    }

    /**
     * Get git repository information
     */
    async getRepositoryInfo() {
        try {
            const remoteUrl = await executeCommand('git config --get remote.origin.url', {
                timeout: this.timeout
            });

            const branch = await executeCommand('git branch --show-current', {
                timeout: this.timeout
            });

            const lastCommit = await executeCommand('git log -1 --format="%H %s"', {
                timeout: this.timeout
            });

            return {
                remoteUrl: remoteUrl.trim(),
                currentBranch: branch.trim(),
                lastCommit: lastCommit.trim(),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            throw new Error(`Failed to get repository info: ${error.message}`);
        }
    }

    /**
     * Validate git service health
     */
    async validateService() {
        try {
            if (!this.enabled) {
                return {
                    healthy: true,
                    enabled: false,
                    message: 'Git service is disabled'
                };
            }

            const status = await this.getStatus();
            const repoInfo = await this.getRepositoryInfo();

            return {
                healthy: true,
                enabled: true,
                status,
                repository: repoInfo,
                config: {
                    maxRetries: this.maxRetries,
                    timeout: this.timeout,
                    autoCommit: this.autoCommit
                }
            };
        } catch (error) {
            return {
                healthy: false,
                enabled: this.enabled,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = GitService;