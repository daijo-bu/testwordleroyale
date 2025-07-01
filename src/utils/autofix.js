class AutoFix {
  constructor(gameController, botController) {
    this.gameController = gameController;
    this.botController = botController;
    this.fixAttempts = new Map();
    this.maxRetries = 3;
  }

  async handleError(error, context, retryFunction = null) {
    const errorKey = `${context}-${error.message.substring(0, 50)}`;
    const attempts = this.fixAttempts.get(errorKey) || 0;
    
    if (attempts >= this.maxRetries) {
      console.log(`🛑 Max retry attempts reached for: ${context}`);
      return false;
    }

    this.fixAttempts.set(errorKey, attempts + 1);
    console.log(`🔧 Auto-fix attempt ${attempts + 1}/${this.maxRetries} for: ${context}`);

    try {
      // Telegram API errors
      if (error.message.includes("can't parse entities")) {
        return await this.fixMarkdownError(error, context, retryFunction);
      }
      
      if (error.message.includes("409 Conflict")) {
        return await this.fixPollingConflict(error, context);
      }
      
      if (error.message.includes("403 Forbidden") || error.message.includes("bot was blocked")) {
        return await this.fixBlockedBot(error, context);
      }
      
      // Database errors
      if (error.message.includes("SQLITE_")) {
        return await this.fixDatabaseError(error, context);
      }
      
      // Network errors
      if (error.message.includes("ECONNREFUSED") || error.message.includes("ENOTFOUND")) {
        return await this.fixNetworkError(error, context, retryFunction);
      }
      
      // Generic retry for other errors
      if (retryFunction) {
        return await this.genericRetry(error, context, retryFunction);
      }
      
      return false;
    } catch (fixError) {
      console.log(`❌ Auto-fix failed: ${fixError.message}`);
      return false;
    }
  }

  async fixMarkdownError(error, context, retryFunction) {
    console.log(`🔧 Fixing Markdown parsing error...`);
    
    // Strategy 1: Remove all markdown formatting
    if (retryFunction) {
      try {
        await retryFunction({ useMarkdown: false });
        console.log(`✅ Fixed by removing Markdown formatting`);
        return true;
      } catch (retryError) {
        console.log(`❌ Markdown removal didn't work`);
      }
    }
    
    // Strategy 2: Use HTML parsing instead
    try {
      if (retryFunction) {
        await retryFunction({ parseMode: 'HTML' });
        console.log(`✅ Fixed by switching to HTML parsing`);
        return true;
      }
    } catch (htmlError) {
      console.log(`❌ HTML parsing didn't work`);
    }
    
    return false;
  }

  async fixPollingConflict(error, context) {
    console.log(`🔧 Fixing polling conflict...`);
    
    try {
      // Stop current polling
      if (this.botController.bot) {
        await this.botController.bot.stopPolling();
        console.log(`🛑 Stopped current polling`);
      }
      
      // Wait 10 seconds
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Clear webhook
      const token = process.env.TELEGRAM_BOT_TOKEN;
      await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`, {
        method: 'POST'
      });
      console.log(`🗑️  Cleared webhook`);
      
      // Wait another 5 seconds
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Restart polling
      await this.botController.bot.startPolling({ restart: true });
      console.log(`✅ Restarted polling`);
      
      return true;
    } catch (fixError) {
      console.log(`❌ Polling fix failed: ${fixError.message}`);
      return false;
    }
  }

  async fixBlockedBot(error, context) {
    console.log(`🔧 Handling blocked bot scenario...`);
    
    // Can't really "fix" being blocked, but we can handle it gracefully
    if (context.includes('chat')) {
      const chatId = context.match(/chat:?\s*(-?\d+)/)?.[1];
      if (chatId && chatId < 0) {
        // It's a group, deactivate it
        await this.gameController.player.deactivateChatGroup(parseInt(chatId));
        console.log(`🗑️  Deactivated blocked group: ${chatId}`);
        return true;
      }
    }
    
    console.log(`ℹ️  Bot blocked by user - this is normal, no action needed`);
    return true; // Not really an error we need to fix
  }

  async fixDatabaseError(error, context) {
    console.log(`🔧 Fixing database error...`);
    
    try {
      // Try to reconnect to database
      await this.gameController.db.initialize();
      console.log(`✅ Database reconnected`);
      return true;
    } catch (dbError) {
      console.log(`❌ Database reconnection failed: ${dbError.message}`);
      return false;
    }
  }

  async fixNetworkError(error, context, retryFunction) {
    console.log(`🔧 Fixing network error...`);
    
    // Exponential backoff retry
    const delays = [1000, 3000, 5000]; // 1s, 3s, 5s
    
    for (let i = 0; i < delays.length; i++) {
      console.log(`⏳ Waiting ${delays[i]}ms before retry ${i + 1}...`);
      await new Promise(resolve => setTimeout(resolve, delays[i]));
      
      try {
        if (retryFunction) {
          await retryFunction();
          console.log(`✅ Network retry ${i + 1} succeeded`);
          return true;
        }
      } catch (retryError) {
        console.log(`❌ Network retry ${i + 1} failed: ${retryError.message}`);
      }
    }
    
    return false;
  }

  async genericRetry(error, context, retryFunction) {
    console.log(`🔧 Generic retry for: ${context}`);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      await retryFunction();
      console.log(`✅ Generic retry succeeded`);
      return true;
    } catch (retryError) {
      console.log(`❌ Generic retry failed: ${retryError.message}`);
      return false;
    }
  }

  // Method to wrap functions with auto-fix capability
  wrapWithAutoFix(fn, context) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        console.log(`🚨 Error in ${context}: ${error.message}`);
        
        const retryFunction = async (options = {}) => {
          if (options.useMarkdown === false) {
            // Remove markdown from args if it's a message
            const modifiedArgs = args.map(arg => 
              typeof arg === 'string' ? arg.replace(/[*_`]/g, '') : arg
            );
            return await fn(...modifiedArgs);
          } else if (options.parseMode) {
            // Modify parse mode for Telegram messages
            if (args.length > 2 && typeof args[2] === 'object') {
              args[2].parse_mode = options.parseMode;
            }
            return await fn(...args);
          } else {
            return await fn(...args);
          }
        };
        
        const fixed = await this.handleError(error, context, retryFunction);
        
        if (!fixed) {
          console.log(`💥 Could not auto-fix error in ${context}`);
          throw error; // Re-throw if we couldn't fix it
        }
        
        console.log(`🎉 Auto-fix successful for ${context}`);
        return null; // Return null to indicate success but no meaningful return value
      }
    };
  }

  // Clean up old fix attempts periodically
  startCleanup() {
    setInterval(() => {
      this.fixAttempts.clear();
      console.log(`🧹 Cleared auto-fix attempt history`);
    }, 60 * 60 * 1000); // Every hour
  }
}

module.exports = AutoFix;