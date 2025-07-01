class AdminController {
  constructor(gameController, database) {
    this.gameController = gameController;
    this.db = database;
    this.adminIds = this.parseAdminIds(process.env.ADMIN_TELEGRAM_IDS);
    this.settings = {
      gameStartCron: process.env.GAME_SCHEDULE_CRON || '0 20 * * *',
      registrationMinutes: parseInt(process.env.REGISTRATION_MINUTES) || 30,
      prizeAmount: parseInt(process.env.PRIZE_AMOUNT) || 100
    };
  }

  parseAdminIds(adminString) {
    if (!adminString) return [];
    return adminString.split(',').map(id => parseInt(id.trim())).filter(Boolean);
  }

  isAdmin(telegramId) {
    return this.adminIds.includes(telegramId);
  }

  async handleAdminCommand(telegramId, command, args, chatId) {
    if (!this.isAdmin(telegramId)) {
      return { success: false, message: '❌ Access denied. Admin only command.' };
    }

    try {
      switch (command) {
        case 'testgame':
          return await this.startTestGame(args, chatId);
        case 'settime':
          return await this.setGameTime(args);
        case 'setregistration':
          return await this.setRegistrationTime(args);
        case 'setprize':
          return await this.setPrizeAmount(args);
        case 'gamesettings':
          return await this.getGameSettings();
        case 'stopgame':
          return await this.stopCurrentGame();
        case 'playerstats':
          return await this.getPlayerStats();
        case 'groups':
          return await this.getGroupStatus();
        default:
          return this.getAdminHelp();
      }
    } catch (error) {
      console.error('Admin command error:', error);
      return { success: false, message: `❌ Error: ${error.message}` };
    }
  }

  async startTestGame(args, chatId) {
    const registrationMinutes = args && args[0] ? parseInt(args[0]) : 2;
    
    console.log(`🧪 Admin starting test game:`);
    console.log(`   Registration time: ${registrationMinutes} minutes`);
    console.log(`   Admin chat ID: ${chatId}`);
    
    if (this.gameController.currentGame && this.gameController.currentGame.status === 'active') {
      console.log(`❌ Game already active, can't start new one`);
      return { success: false, message: '❌ A game is already active. Use /admin stopgame first.' };
    }

    const startTime = new Date();
    console.log(`📅 Creating test game with start time: ${startTime.toISOString()}`);
    
    const gameId = await this.gameController.game.createGame(startTime.toISOString());
    console.log(`✅ Test game created with ID: ${gameId}`);
    
    console.log(`📡 Broadcasting test game announcement...`);
    await this.gameController.broadcast(
      `🧪 *TEST GAME STARTING!* 🧪\n\n` +
      `⏰ *Registration closes in ${registrationMinutes} minute(s)*\n` +
      `💰 *Prize:* $${this.settings.prizeAmount}\n` +
      `⚡ *Format:* Elimination rounds (6→5→4→3→2→1 attempts)\n\n` +
      `🎮 *Type /join to participate!*\n` +
      `📋 *Type /rules for game rules*\n\n` +
      `🔧 Admin test game - results won't affect official stats`
    );
    console.log(`✅ Test game announcement broadcast completed`);

    console.log(`⏰ Setting timer for ${registrationMinutes} minutes to start game...`);
    setTimeout(() => {
      console.log(`🚀 Starting test game ${gameId} now!`);
      this.gameController.startGame(gameId);
    }, registrationMinutes * 60 * 1000);

    return { 
      success: true, 
      message: `✅ Test game scheduled! Registration closes in ${registrationMinutes} minute(s).` 
    };
  }

  async setGameTime(args) {
    if (!args || args.length === 0) {
      return { 
        success: false, 
        message: '❌ Usage: /admin settime <hour> [minute]\nExample: /admin settime 20 30 (8:30 PM UTC)' 
      };
    }

    const hour = parseInt(args[0]);
    const minute = args[1] ? parseInt(args[1]) : 0;

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return { success: false, message: '❌ Invalid time. Hour: 0-23, Minute: 0-59' };
    }

    const newCron = `${minute} ${hour} * * *`;
    this.settings.gameStartCron = newCron;
    
    // Restart scheduler with new time
    this.gameController.restartScheduler(newCron);

    const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} UTC`;
    
    return { 
      success: true, 
      message: `✅ Game time updated to ${timeString}\nNext game will be announced at this time daily.` 
    };
  }

  async setRegistrationTime(args) {
    if (!args || args.length === 0) {
      return { 
        success: false, 
        message: '❌ Usage: /admin setregistration <minutes>\nExample: /admin setregistration 45' 
      };
    }

    const minutes = parseInt(args[0]);
    if (minutes < 1 || minutes > 120) {
      return { success: false, message: '❌ Registration time must be between 1-120 minutes' };
    }

    this.settings.registrationMinutes = minutes;
    this.gameController.setRegistrationTime(minutes);

    return { 
      success: true, 
      message: `✅ Registration time updated to ${minutes} minutes\nPlayers will have ${minutes} minutes to join before games start.` 
    };
  }

  async setPrizeAmount(args) {
    if (!args || args.length === 0) {
      return { 
        success: false, 
        message: '❌ Usage: /admin setprize <amount>\nExample: /admin setprize 200' 
      };
    }

    const amount = parseInt(args[0]);
    if (amount < 0 || amount > 10000) {
      return { success: false, message: '❌ Prize amount must be between 0-10000' };
    }

    this.settings.prizeAmount = amount;
    process.env.PRIZE_AMOUNT = amount.toString();

    return { 
      success: true, 
      message: `✅ Prize amount updated to $${amount}\nThis will be displayed in game announcements.` 
    };
  }

  async getGameSettings() {
    const cronParts = this.settings.gameStartCron.split(' ');
    const hour = parseInt(cronParts[1]);
    const minute = parseInt(cronParts[0]);
    const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} UTC`;

    const currentGame = await this.gameController.game.getCurrentGame();
    const gameStatus = currentGame ? `${currentGame.status} (ID: ${currentGame.id})` : 'No active game';

    return {
      success: true,
      message: `⚙️ *GAME SETTINGS* ⚙️\n\n` +
        `🕒 *Daily Start Time:* ${timeString}\n` +
        `📝 *Registration Period:* ${this.settings.registrationMinutes} minutes\n` +
        `💰 *Prize Amount:* $${this.settings.prizeAmount}\n` +
        `🎮 *Current Game:* ${gameStatus}\n\n` +
        `Use /admin help for configuration commands`
    };
  }

  async stopCurrentGame() {
    if (!this.gameController.currentGame) {
      return { success: false, message: '❌ No active game to stop' };
    }

    const gameId = this.gameController.currentGame.id;
    await this.gameController.game.updateGameStatus(gameId, 'cancelled');
    
    // Clear any active timers
    this.gameController.gameTimers.forEach((timer, key) => {
      clearTimeout(timer);
    });
    this.gameController.gameTimers.clear();
    
    this.gameController.currentGame = null;

    await this.gameController.broadcast(
      `🛑 *GAME CANCELLED* 🛑\n\n` +
      `The current game has been stopped by an admin.\n` +
      `Next scheduled game will be announced as usual.`
    );

    return { success: true, message: '✅ Current game stopped and cancelled' };
  }

  async getPlayerStats() {
    const totalPlayersSql = `SELECT COUNT(*) as count FROM players`;
    const totalGamesSql = `SELECT COUNT(*) as count FROM games WHERE status = 'completed'`;
    const activeGamesSql = `SELECT COUNT(*) as count FROM games WHERE status = 'active'`;
    const recentPlayersSql = `SELECT COUNT(*) as count FROM players WHERE created_at > datetime('now', '-7 days')`;

    const [totalPlayers, totalGames, activeGames, recentPlayers] = await Promise.all([
      this.db.get(totalPlayersSql),
      this.db.get(totalGamesSql),
      this.db.get(activeGamesSql),
      this.db.get(recentPlayersSql)
    ]);

    return {
      success: true,
      message: `📊 *PLAYER STATISTICS* 📊\n\n` +
        `👥 *Total Players:* ${totalPlayers.count}\n` +
        `🆕 *New This Week:* ${recentPlayers.count}\n` +
        `🎮 *Games Completed:* ${totalGames.count}\n` +
        `🟢 *Active Games:* ${activeGames.count}\n\n` +
        `Use /leaderboard to see top players`
    };
  }

  getAdminHelp() {
    return {
      success: true,
      message: `🔧 *ADMIN COMMANDS* 🔧\n\n` +
        `*Game Control:*\n` +
        `/admin testgame [minutes] - Start test game\n` +
        `/admin stopgame - Stop current game\n\n` +
        `*Configuration:*\n` +
        `/admin settime <hour> [minute] - Set daily start time\n` +
        `/admin setregistration <minutes> - Set registration period\n` +
        `/admin setprize <amount> - Set prize amount\n\n` +
        `*Information:*\n` +
        `/admin gamesettings - View current settings\n` +
        `/admin playerstats - View player statistics\n` +
        `/admin groups - View broadcast status\n` +
        `/admin help - Show this help\n\n` +
        `*Examples:*\n` +
        `• /admin testgame 3 - Test game, 3min registration\n` +
        `• /admin settime 21 30 - Games at 9:30 PM UTC\n` +
        `• /admin setregistration 45 - 45min registration`
    };
  }

  async getGroupStatus() {
    const activeGroupsSql = `SELECT * FROM chat_groups WHERE is_active = 1`;
    const activeGroups = await this.db.all(activeGroupsSql);
    
    const currentGame = await this.gameController.game.getCurrentGame();
    let dmParticipants = [];
    
    if (currentGame) {
      const participants = await this.gameController.game.getGameParticipants(currentGame.id, true);
      dmParticipants = participants.filter(p => p.chat_id > 0);
    }
    
    let message = `📊 *BROADCAST STATUS* 📊\n\n`;
    message += `*Active Groups:* ${activeGroups.length}\n`;
    message += `*DM Participants:* ${dmParticipants.length}\n`;
    message += `*Total Recipients:* ${activeGroups.length + dmParticipants.length}\n\n`;
    
    if (activeGroups.length > 0) {
      message += `*Groups:*\n`;
      activeGroups.forEach(group => {
        const title = group.chat_title || 'Unknown';
        message += `• ${title} (${group.chat_id})\n`;
      });
    } else {
      message += `⚠️ *No active groups!*\nAdd bot to Telegram groups to enable broadcasting.\n`;
    }
    
    if (dmParticipants.length > 0) {
      message += `\n*DM Participants:* ${dmParticipants.length} players\n`;
    }
    
    return {
      success: true,
      message
    };
  }
}

module.exports = AdminController;