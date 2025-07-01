require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const DatabaseService = require('./services/database');
const GameController = require('./controllers/game');
const BotController = require('./controllers/bot');

class WordleRoyaleBot {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    if (!this.token) {
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }
    
    // Force polling for now (webhooks need Railway domain setup)
    const useWebhook = false;
    
    if (useWebhook) {
      this.bot = new TelegramBot(this.token, { polling: false });
      this.app = express();
      this.port = process.env.PORT || 3000;
    } else {
      this.bot = new TelegramBot(this.token, { 
        polling: {
          interval: 1000,
          autoStart: false
        }
      });
    }
    
    this.database = new DatabaseService();
    this.gameController = new GameController(this.database);
    this.botController = new BotController(this.bot, this.gameController);
  }

  async start() {
    try {
      await this.database.initialize();
      this.botController.setupCommands();
      
      const useWebhook = process.env.NODE_ENV === 'production';
      
      if (useWebhook) {
        await this.setupWebhook();
      } else {
        await this.setupPolling();
      }
      
      this.gameController.startScheduler();
      
      console.log('🎯 Wordle Royale Bot started successfully!');
      console.log('Waiting for games and players...');
    } catch (error) {
      console.error('Failed to start bot:', error);
      process.exit(1);
    }
  }

  async setupWebhook() {
    // Railway provides the public URL via these environment variables
    const publicUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
      || process.env.RAILWAY_STATIC_URL 
      || process.env.PUBLIC_URL;
    
    if (!publicUrl) {
      console.log('⚠️  No public URL found, falling back to polling...');
      return this.setupPolling();
    }
    
    const webhookUrl = `https://${publicUrl}/webhook`;
    
    // Set up Express server
    this.app.use(express.json());
    
    // Health check endpoint
    this.app.get('/', (req, res) => {
      res.json({ 
        status: 'Wordle Royale Bot is running!',
        webhook: webhookUrl,
        timestamp: new Date().toISOString()
      });
    });
    
    // Webhook endpoint
    this.app.post('/webhook', (req, res) => {
      try {
        this.bot.processUpdate(req.body);
        res.sendStatus(200);
      } catch (error) {
        console.error('Webhook processing error:', error);
        res.sendStatus(500);
      }
    });
    
    // Start server
    this.app.listen(this.port, () => {
      console.log(`🌐 Webhook server listening on port ${this.port}`);
    });
    
    // Set webhook
    try {
      await this.bot.setWebHook(webhookUrl);
      console.log(`📡 Webhook set to: ${webhookUrl}`);
      
      // Verify webhook was set
      const webhookInfo = await this.bot.getWebHookInfo();
      console.log(`✅ Webhook verified: ${webhookInfo.url}`);
    } catch (error) {
      console.error('Webhook setup failed:', error.message);
      console.log('🔄 Falling back to polling...');
      return this.setupPolling();
    }
  }

  async setupPolling() {
    // Handle polling errors more gracefully
    this.bot.on('polling_error', (error) => {
      console.error('Polling error:', error.message);
      
      if (error.message.includes('409 Conflict')) {
        console.log('🔄 Conflict detected - waiting 30 seconds before restart...');
        setTimeout(() => {
          console.log('🔄 Restarting due to conflict...');
          process.exit(1);
        }, 30000);
        return;
      }
      
      // Log other errors but don't restart
      console.log('⚠️  Non-fatal polling error, continuing...');
    });
    
    // Longer delay to ensure conflicts are resolved
    console.log('⏳ Starting polling in 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    try {
      // Start polling with retry
      await this.bot.startPolling({ restart: true });
      console.log('📡 Polling started successfully');
    } catch (error) {
      console.error('Failed to start polling:', error.message);
      if (error.message.includes('409')) {
        console.log('🔄 Immediate conflict - restarting in 60 seconds...');
        setTimeout(() => process.exit(1), 60000);
      } else {
        throw error;
      }
    }
  }
}

const bot = new WordleRoyaleBot();
bot.start();