const Player = require('../models/player');
const AdminController = require('./admin');

class BotController {
  constructor(bot, gameController, monitor = null) {
    this.bot = bot;
    this.gameController = gameController;
    this.player = new Player(gameController.db);
    this.admin = new AdminController(gameController, gameController.db, monitor);
    this.monitor = monitor;
    
    // Set up broadcasting
    this.gameController.setBroadcastCallback(this.broadcastToAllGroups.bind(this));
  }

  setupCommands() {
    // Command handlers
    this.bot.onText(/\/start/, this.handleStart.bind(this));
    this.bot.onText(/\/join/, this.handleJoin.bind(this));
    this.bot.onText(/\/status/, this.handleStatus.bind(this));
    this.bot.onText(/\/rules/, this.handleRules.bind(this));
    this.bot.onText(/\/stats/, this.handleStats.bind(this));
    this.bot.onText(/\/leaderboard/, this.handleLeaderboard.bind(this));
    
    // Admin commands
    this.bot.onText(/\/admin (.+)/, this.handleAdmin.bind(this));
    
    // Debug command (works for everyone)
    this.bot.onText(/\/debug/, this.handleDebug.bind(this));
    
    // Handle 5-letter word guesses
    this.bot.on('message', this.handleMessage.bind(this));
    
    // Handle group events
    this.bot.on('new_chat_members', this.handleNewChatMembers.bind(this));
    this.bot.on('left_chat_member', this.handleLeftChatMember.bind(this));
    
    console.log('🤖 Bot commands set up successfully');
  }

  async handleStart(msg) {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    try {
      await this.player.registerChatGroup(chatId, msg.chat.title);
      
      const welcomeMessage = 
        `🎯 *Welcome to Wordle Royale!* 🎯\n\n` +
        `The ultimate competitive word-guessing battle royale!\n\n` +
        `🏆 *How it works:*\n` +
        `• Daily elimination tournaments\n` +
        `• 6 rounds with decreasing attempts (6→5→4→3→2→1)\n` +
        `• Last player standing wins $${process.env.PRIZE_AMOUNT || 100}!\n\n` +
        `🎮 *Commands:*\n` +
        `/join - Register for next game\n` +
        `/status - Check current game\n` +
        `/rules - Game rules\n` +
        `/stats - Your statistics\n` +
        `/leaderboard - Top players\n\n` +
        `🚀 *Ready to play?* Use /join for the next game!`;
      
      await this.bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error in handleStart:', error);
      await this.bot.sendMessage(chatId, 'Welcome to Wordle Royale! Use /join to participate in games.');
    }
  }

  async handleJoin(msg) {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    try {
      console.log(`📥 Received /join command:`);
      console.log(`   User: ${user.first_name} (@${user.username})`);
      console.log(`   Chat ID: ${chatId} (${chatId > 0 ? 'DM' : 'Group'})`);
      
      const result = await this.gameController.joinGame(
        user.id,
        user.username,
        user.first_name,
        chatId
      );
      
      console.log(`📤 Sending join response to ${chatId}: ${result.success ? 'Success' : 'Failed'}`);
      await this.bot.sendMessage(chatId, result.message, { parse_mode: 'Markdown' });
      console.log(`✅ Join response sent successfully`);
    } catch (error) {
      console.error('❌ Error in handleJoin:', error);
      await this.bot.sendMessage(chatId, 'Error joining game. Please try again.');
    }
  }

  async handleStatus(msg) {
    const chatId = msg.chat.id;
    
    try {
      const status = await this.gameController.getGameStatus();
      await this.bot.sendMessage(chatId, status, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error in handleStatus:', error);
      await this.bot.sendMessage(chatId, 'Error getting game status.');
    }
  }

  async handleRules(msg) {
    const chatId = msg.chat.id;
    
    const rules = 
      `📋 *WORDLE ROYALE RULES* 📋\n\n` +
      `🎯 *Objective:* Be the last player standing!\n\n` +
      `🔄 *Round Structure:*\n` +
      `• Round 1: 6 attempts, 10 minutes\n` +
      `• Round 2: 5 attempts, 8 minutes\n` +
      `• Round 3: 4 attempts, 7 minutes\n` +
      `• Round 4: 3 attempts, 6 minutes\n` +
      `• Round 5: 2 attempts, 5 minutes\n` +
      `• Final: 1 attempt, 5 minutes\n\n` +
      `⚡ *Elimination:* Fail to solve = eliminated\n` +
      `🏆 *Victory:* Last player wins $${process.env.PRIZE_AMOUNT || 100}\n` +
      `🤝 *Final Round:* If all solve, prize is shared\n\n` +
      `🎮 *How to Play:*\n` +
      `1. Use /join before game starts\n` +
      `2. Send 5-letter words as guesses\n` +
      `3. Get color-coded feedback\n` +
      `4. Solve before time/attempts run out\n\n` +
      `🟩 = Correct letter & position\n` +
      `🟨 = Correct letter, wrong position\n` +
      `⬜ = Letter not in word`;
    
    try {
      await this.bot.sendMessage(chatId, rules, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error in handleRules:', error);
      await this.bot.sendMessage(chatId, 'Error displaying rules.');
    }
  }

  async handleStats(msg) {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    try {
      const stats = await this.player.getPlayerStats(user.id);
      
      if (!stats || stats.total_games === 0) {
        await this.bot.sendMessage(
          chatId, 
          `📊 *${user.first_name}'s Stats*\n\nNo games played yet! Use /join to start playing.`
        );
        return;
      }
      
      const winRate = stats.total_games > 0 ? ((stats.wins / stats.total_games) * 100).toFixed(1) : '0.0';
      const avgRound = stats.avg_elimination_round ? stats.avg_elimination_round.toFixed(1) : 'N/A';
      
      const statsMessage = 
        `📊 *${user.first_name}'s Stats* 📊\n\n` +
        `🎮 *Games Played:* ${stats.total_games}\n` +
        `🏆 *Wins:* ${stats.wins}\n` +
        `📈 *Win Rate:* ${winRate}%\n` +
        `🎯 *Avg Round Reached:* ${avgRound}\n\n` +
        `Use /leaderboard to see top players!`;
      
      await this.bot.sendMessage(chatId, statsMessage, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error in handleStats:', error);
      await this.bot.sendMessage(chatId, 'Error getting your stats.');
    }
  }

  async handleLeaderboard(msg) {
    const chatId = msg.chat.id;
    
    try {
      const leaderboard = await this.player.getLeaderboard(10);
      
      if (leaderboard.length === 0) {
        await this.bot.sendMessage(chatId, '📊 *Leaderboard*\n\nNo games completed yet!');
        return;
      }
      
      let message = '🏆 *WORDLE ROYALE LEADERBOARD* 🏆\n\n';
      
      leaderboard.forEach((player, index) => {
        const rank = index + 1;
        const name = player.first_name || player.username || 'Unknown';
        const winRate = player.win_rate || 0;
        const avgRound = player.avg_round_reached ? player.avg_round_reached.toFixed(1) : 'N/A';
        
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
        
        message += `${medal} *${name}*\n`;
        message += `   🏆 ${player.wins} wins | 📈 ${winRate}% | 🎯 ${avgRound} avg\n\n`;
      });
      
      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error in handleLeaderboard:', error);
      await this.bot.sendMessage(chatId, 'Error getting leaderboard.');
    }
  }

  async handleAdmin(msg, match) {
    const chatId = msg.chat.id;
    const user = msg.from;
    const commandText = match[1];
    const args = commandText.split(' ');
    const command = args[0].toLowerCase();
    const commandArgs = args.slice(1);

    try {
      const result = await this.admin.handleAdminCommand(
        user.id,
        command,
        commandArgs,
        chatId
      );
      
      await this.bot.sendMessage(chatId, result.message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error in handleAdmin:', error);
      await this.bot.sendMessage(chatId, '❌ Error processing admin command.');
    }
  }

  async handleDebug(msg) {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    try {
      const adminIds = process.env.ADMIN_TELEGRAM_IDS || 'Not set';
      const isAdmin = this.admin.isAdmin(user.id);
      
      const debugInfo = 
        `🔧 *DEBUG INFO* 🔧\n\n` +
        `*Your Telegram ID:* ${user.id}\n` +
        `*Admin IDs Config:* ${adminIds}\n` +
        `*Are you admin?* ${isAdmin ? '✅ Yes' : '❌ No'}\n` +
        `*Node Environment:* ${process.env.NODE_ENV || 'development'}\n` +
        `*Bot Username:* @${(await this.bot.getMe()).username}\n\n` +
        `If admin access isn't working, check Railway environment variables.`;
      
      await this.bot.sendMessage(chatId, debugInfo, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error in handleDebug:', error);
      await this.bot.sendMessage(chatId, '❌ Debug command failed.');
    }
  }

  async handleMessage(msg) {
    // Skip if it's a command
    if (msg.text && msg.text.startsWith('/')) return;
    
    // Check if it's a 5-letter word guess
    if (msg.text && msg.text.length === 5 && /^[A-Za-z]+$/.test(msg.text)) {
      const chatId = msg.chat.id;
      const user = msg.from;
      
      try {
        const result = await this.gameController.processGuess(
          user.id,
          msg.text.toUpperCase(),
          chatId
        );
        
        if (result.success) {
          await this.bot.sendMessage(chatId, result.message, { parse_mode: 'Markdown' });
        } else {
          await this.bot.sendMessage(chatId, `❌ ${result.message}`);
        }
      } catch (error) {
        console.error('Error processing guess:', error);
        await this.bot.sendMessage(chatId, 'Error processing your guess.');
      }
    }
  }

  async handleNewChatMembers(msg) {
    const chatId = msg.chat.id;
    const newMembers = msg.new_chat_members;
    
    for (const member of newMembers) {
      if (member.id === this.bot.options.bot_id) {
        // Bot was added to group
        await this.player.registerChatGroup(chatId, msg.chat.title);
        
        const welcomeMessage = 
          `🎯 *Wordle Royale Bot Added!* 🎯\n\n` +
          `Thanks for adding me to your group!\n\n` +
          `🎮 *I bring competitive word battles:*\n` +
          `• Daily elimination tournaments\n` +
          `• Real-time multiplayer Wordle\n` +
          `• Cash prizes for winners!\n\n` +
          `🚀 *Get started:* /join for next game\n` +
          `📋 *Learn more:* /rules`;
        
        await this.bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
      }
    }
  }

  async handleLeftChatMember(msg) {
    const chatId = msg.chat.id;
    const leftMember = msg.left_chat_member;
    
    if (leftMember.id === this.bot.options.bot_id) {
      // Bot was removed from group
      await this.player.deactivateChatGroup(chatId);
      console.log(`Bot removed from group: ${chatId}`);
    }
  }

  async broadcastToAllGroups(message, options = {}) {
    try {
      const activeGroups = await this.player.getActiveChatGroups();
      console.log(`🔍 Broadcasting to ${activeGroups.length} active groups`);
      
      // Also get all active game participants for DM updates
      const currentGame = await this.gameController.game.getCurrentGame();
      let dmParticipants = [];
      
      if (currentGame) {
        const participants = await this.gameController.game.getGameParticipants(currentGame.id, true);
        // Get unique DM chat IDs (negative IDs are groups, positive are DMs)
        dmParticipants = participants
          .filter(p => p.chat_id > 0) // Positive IDs are DMs
          .map(p => ({ chat_id: p.chat_id }));
        console.log(`🔍 Broadcasting to ${dmParticipants.length} DM participants`);
      }
      
      // Combine groups and DM participants, removing duplicates
      const allRecipients = [];
      const seenChatIds = new Set();
      
      [...activeGroups, ...dmParticipants].forEach(recipient => {
        if (!seenChatIds.has(recipient.chat_id)) {
          seenChatIds.add(recipient.chat_id);
          allRecipients.push(recipient);
        }
      });
      
      console.log(`📡 Total broadcast recipients: ${allRecipients.length}`);
      
      if (allRecipients.length === 0) {
        console.log('⚠️  No recipients found for broadcast!');
        console.log('Add the bot to Telegram groups or join via DM to receive messages.');
        return;
      }
      
      for (const recipient of allRecipients) {
        try {
          console.log(`📤 Sending to chat: ${recipient.chat_id}`);
          await this.bot.sendMessage(recipient.chat_id, message, { 
            parse_mode: 'Markdown',
            ...options 
          });
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`❌ Error broadcasting to chat ${recipient.chat_id}:`, error.message);
          
          // Try sending without Markdown if parsing fails
          if (error.message.includes("can't parse entities")) {
            try {
              console.log(`🔄 Retrying without Markdown for chat ${recipient.chat_id}`);
              // Remove all markdown formatting and send plain text
              const plainMessage = message.replace(/\*/g, '').replace(/_/g, '');
              await this.bot.sendMessage(recipient.chat_id, plainMessage);
              console.log(`✅ Plain text message sent successfully to ${recipient.chat_id}`);
            } catch (retryError) {
              console.error(`❌ Retry also failed for chat ${recipient.chat_id}:`, retryError.message);
            }
          }
          
          // If bot was blocked or removed from group, deactivate it
          if ((error.code === 403 || error.code === 400) && recipient.chat_id < 0) {
            await this.player.deactivateChatGroup(recipient.chat_id);
          }
          
          // For DMs, just log the error (user might have blocked bot)
          if (recipient.chat_id > 0) {
            console.log(`User ${recipient.chat_id} may have blocked the bot`);
          }
        }
      }
    } catch (error) {
      console.error('Error in broadcastToAllGroups:', error);
    }
  }
}

module.exports = BotController;