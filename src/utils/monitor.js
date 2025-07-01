class BotMonitor {
  constructor(gameController, botController) {
    this.gameController = gameController;
    this.botController = botController;
    this.errors = [];
    this.stats = {
      messagesAttempted: 0,
      messagesFailed: 0,
      lastHealthCheck: new Date(),
      uptimeStart: new Date()
    };
    
    // Start monitoring
    this.startHealthChecks();
    this.startErrorTracking();
  }

  logError(error, context = '') {
    const errorInfo = {
      timestamp: new Date(),
      error: error.message,
      context,
      stack: error.stack
    };
    
    this.errors.push(errorInfo);
    
    // Keep only last 50 errors
    if (this.errors.length > 50) {
      this.errors = this.errors.slice(-50);
    }
    
    console.log(`🚨 Error logged: ${context} - ${error.message}`);
    
    // Auto-report critical errors
    if (this.isCriticalError(error)) {
      this.reportCriticalError(errorInfo);
    }
  }

  isCriticalError(error) {
    const criticalPatterns = [
      'ETELEGRAM',
      'Database',
      'polling_error',
      'SQLITE_',
      'Connection refused'
    ];
    
    return criticalPatterns.some(pattern => 
      error.message.includes(pattern) || error.stack?.includes(pattern)
    );
  }

  async reportCriticalError(errorInfo) {
    const adminIds = process.env.ADMIN_TELEGRAM_IDS?.split(',') || [];
    
    if (adminIds.length === 0) return;
    
    const errorReport = 
      `🚨 CRITICAL ERROR DETECTED 🚨\n\n` +
      `Time: ${errorInfo.timestamp.toISOString()}\n` +
      `Context: ${errorInfo.context}\n` +
      `Error: ${errorInfo.error}\n\n` +
      `Bot Status: ${await this.getHealthStatus()}\n\n` +
      `Auto-recovery will be attempted.`;
    
    for (const adminId of adminIds) {
      try {
        await this.botController.bot.sendMessage(adminId.trim(), errorReport);
      } catch (err) {
        console.log(`Failed to notify admin ${adminId}: ${err.message}`);
      }
    }
  }

  async getHealthStatus() {
    const uptime = Date.now() - this.stats.uptimeStart.getTime();
    const uptimeHours = Math.floor(uptime / (1000 * 60 * 60));
    const uptimeMinutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    
    const errorRate = this.stats.messagesAttempted > 0 
      ? ((this.stats.messagesFailed / this.stats.messagesAttempted) * 100).toFixed(1)
      : 0;
    
    const recentErrors = this.errors.filter(e => 
      Date.now() - e.timestamp.getTime() < 60 * 60 * 1000 // Last hour
    ).length;
    
    return `Uptime: ${uptimeHours}h ${uptimeMinutes}m | ` +
           `Error Rate: ${errorRate}% | ` +
           `Recent Errors: ${recentErrors}/hour`;
  }

  startHealthChecks() {
    // Health check every 5 minutes
    setInterval(async () => {
      try {
        this.stats.lastHealthCheck = new Date();
        
        // Test bot connectivity
        await this.botController.bot.getMe();
        
        // Test database
        await this.gameController.db.get('SELECT 1');
        
        console.log(`💚 Health check passed - ${await this.getHealthStatus()}`);
      } catch (error) {
        console.log(`❤️  Health check failed: ${error.message}`);
        this.logError(error, 'Health Check');
      }
    }, 5 * 60 * 1000);
  }

  startErrorTracking() {
    // Global error handlers
    process.on('uncaughtException', (error) => {
      console.log('🔥 Uncaught Exception:', error.message);
      this.logError(error, 'Uncaught Exception');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.log('🔥 Unhandled Rejection:', reason);
      this.logError(new Error(reason), 'Unhandled Rejection');
    });
  }

  recordMessageAttempt() {
    this.stats.messagesAttempted++;
  }

  recordMessageFailure() {
    this.stats.messagesFailed++;
  }

  async getDiagnosticReport() {
    const gameStatus = await this.gameController.getGameStatus();
    const activeGroups = await this.gameController.player.getActiveChatGroups();
    
    const report = 
      `🔧 BOT DIAGNOSTIC REPORT 🔧\n\n` +
      `${await this.getHealthStatus()}\n\n` +
      `Active Groups: ${activeGroups.length}\n` +
      `Current Game: ${this.gameController.currentGame ? 'Active' : 'None'}\n` +
      `Recent Errors: ${this.errors.slice(-5).length}\n\n` +
      `Last 3 Errors:\n` +
      this.errors.slice(-3).map(e => 
        `• ${e.timestamp.toLocaleTimeString()}: ${e.context} - ${e.error.substring(0, 50)}...`
      ).join('\n');
    
    return report;
  }
}

module.exports = BotMonitor;