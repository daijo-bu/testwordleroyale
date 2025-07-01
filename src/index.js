require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const DatabaseService = require('./services/database');
const GameController = require('./controllers/game');
const BotController = require('./controllers/bot');

class WordleRoyaleBot {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    if (!this.token) {
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }
    
    // Add polling error handling
    this.bot = new TelegramBot(this.token, { 
      polling: {
        interval: 1000,
        autoStart: false
      }
    });
    
    this.database = new DatabaseService();
    this.gameController = new GameController(this.database);
    this.botController = new BotController(this.bot, this.gameController);
  }

  async start() {
    try {
      await this.database.initialize();
      this.botController.setupCommands();
      
      // Handle polling errors
      this.bot.on('polling_error', (error) => {
        console.error('Polling error:', error.message);
        if (error.message.includes('409 Conflict')) {
          console.log('🔄 Another bot instance detected. Stopping this instance.');
          process.exit(1);
        }
      });
      
      // Start polling
      await this.bot.startPolling();
      this.gameController.startScheduler();
      
      console.log('🎯 Wordle Royale Bot started successfully!');
      console.log('Waiting for games and players...');
    } catch (error) {
      console.error('Failed to start bot:', error);
      process.exit(1);
    }
  }
}

const bot = new WordleRoyaleBot();
bot.start();