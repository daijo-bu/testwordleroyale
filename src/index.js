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
    
    // Use webhooks in production, polling in development
    const useWebhook = process.env.NODE_ENV === 'production';
    
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
    const webhookUrl = `${process.env.RAILWAY_STATIC_URL || 'https://your-app.railway.app'}/webhook`;
    
    // Set up Express server
    this.app.use(express.json());
    
    // Health check endpoint
    this.app.get('/', (req, res) => {
      res.json({ status: 'Wordle Royale Bot is running!' });
    });
    
    // Webhook endpoint
    this.app.post('/webhook', (req, res) => {
      this.bot.processUpdate(req.body);
      res.sendStatus(200);
    });
    
    // Start server
    this.app.listen(this.port, () => {
      console.log(`🌐 Webhook server listening on port ${this.port}`);
    });
    
    // Set webhook
    try {
      await this.bot.setWebHook(webhookUrl);
      console.log(`📡 Webhook set to: ${webhookUrl}`);
    } catch (error) {
      console.error('Webhook setup failed:', error.message);
      throw error;
    }
  }

  async setupPolling() {
    // Handle polling errors
    this.bot.on('polling_error', (error) => {
      console.error('Polling error:', error.message);
      if (error.message.includes('409 Conflict')) {
        console.log('🔄 Another bot instance detected. Restarting...');
        setTimeout(() => process.exit(1), 5000);
        return;
      }
    });
    
    // Small delay to ensure clean start
    console.log('⏳ Starting polling in 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Start polling
    await this.bot.startPolling();
    console.log('📡 Polling started');
  }
}

const bot = new WordleRoyaleBot();
bot.start();