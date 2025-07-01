const cron = require('node-cron');
const Game = require('../models/game');
const Player = require('../models/player');
const { getRandomGameWord, isValidWord, getWordFeedback, formatFeedbackForTelegram } = require('../utils/words');
const { cleanText } = require('../utils/markdown');

class GameController {
  constructor(database) {
    this.db = database;
    this.game = new Game(database);
    this.player = new Player(database);
    this.currentGame = null;
    this.gameTimers = new Map();
    this.broadcastCallback = null;
    this.cronJob = null;
    this.registrationMinutes = parseInt(process.env.REGISTRATION_MINUTES) || 30;
  }

  setBroadcastCallback(callback) {
    this.broadcastCallback = callback;
  }

  async broadcast(message, options = {}) {
    if (this.broadcastCallback) {
      await this.broadcastCallback(message, options);
    }
  }

  startScheduler() {
    const schedule = process.env.GAME_SCHEDULE_CRON || '0 20 * * *'; // 8 PM daily
    
    this.cronJob = cron.schedule(schedule, async () => {
      try {
        await this.scheduleNewGame();
      } catch (error) {
        console.error('Error scheduling game:', error);
      }
    });

    console.log(`🕒 Game scheduler started with cron: ${schedule}`);
  }

  restartScheduler(newSchedule) {
    if (this.cronJob) {
      this.cronJob.destroy();
    }
    
    this.cronJob = cron.schedule(newSchedule, async () => {
      try {
        await this.scheduleNewGame();
      } catch (error) {
        console.error('Error scheduling game:', error);
      }
    });

    console.log(`🕒 Game scheduler restarted with cron: ${newSchedule}`);
  }

  setRegistrationTime(minutes) {
    this.registrationMinutes = minutes;
  }

  async scheduleNewGame() {
    const startTime = new Date();
    const gameId = await this.game.createGame(startTime.toISOString());
    
    await this.broadcast(
      `🎯 *WORDLE ROYALE STARTING IN ${this.registrationMinutes} MINUTES!* 🎯\n\n` +
      `📅 *Start Time:* ${new Date(Date.now() + this.registrationMinutes * 60 * 1000).toLocaleTimeString()}\n` +
      `💰 *Prize:* $${process.env.PRIZE_AMOUNT || 100}\n` +
      `⚡ *Format:* Elimination rounds (6→5→4→3→2→1 attempts)\n\n` +
      `Type /join to participate!\n` +
      `Type /rules for game rules`
    );

    setTimeout(() => {
      this.startGame(gameId);
    }, this.registrationMinutes * 60 * 1000);

    return gameId;
  }

  async startGame(gameId) {
    try {
      this.currentGame = await this.game.getGame(gameId);
      if (!this.currentGame) {
        throw new Error('Game not found');
      }

      const participants = await this.game.getGameParticipants(gameId);
      if (participants.length === 0) {
        await this.broadcast(`😔 **Game Cancelled** - No players joined!`);
        return;
      }

      await this.game.updateGameStatus(gameId, 'active');
      await this.game.updatePlayerCounts(gameId, participants.length, participants.length);

      console.log(`🎮 Starting game ${gameId} with ${participants.length} players`);
      
      await this.startRound(gameId, 1);
    } catch (error) {
      console.error('Error starting game:', error);
      await this.broadcast(`❌ **Error starting game:** ${error.message}`);
    }
  }

  async startRound(gameId, roundNumber) {
    try {
      const word = getRandomGameWord();
      await this.game.setGameWord(gameId, word);
      await this.game.updateRound(gameId, roundNumber);
      
      const config = this.game.getRoundConfig(roundNumber);
      const stats = await this.game.getGameStats(gameId);
      
      await this.broadcast(
        `🎯 *WORDLE ROYALE - ROUND ${roundNumber}* 🎯\n\n` +
        `Word: _ _ _ _ _\n` +
        `👥 *Players:* ${stats.active} active\n` +
        `🎯 *Attempts:* ${config.maxAttempts} remaining\n` +
        `⏰ *Time:* ${Math.floor(config.timeLimit / 1000 / 60)} minutes\n\n` +
        `🔤 *Send your 5-letter guess now!*`
      );

      this.setRoundTimer(gameId, roundNumber, config.timeLimit);
    } catch (error) {
      console.error('Error starting round:', error);
    }
  }

  setRoundTimer(gameId, roundNumber, timeLimit) {
    const timerId = setTimeout(async () => {
      await this.endRound(gameId, roundNumber);
    }, timeLimit);

    this.gameTimers.set(`${gameId}-${roundNumber}`, timerId);

    setTimeout(async () => {
      const stats = await this.game.getGameStats(gameId);
      await this.broadcast(
        `⏰ *Time Warning!* 2 minutes remaining!\n` +
        `Round ${roundNumber} - ${stats.active} players still active`
      );
    }, timeLimit - 2 * 60 * 1000); // 2 minutes before end
  }

  async endRound(gameId, roundNumber) {
    try {
      const timerId = this.gameTimers.get(`${gameId}-${roundNumber}`);
      if (timerId) {
        clearTimeout(timerId);
        this.gameTimers.delete(`${gameId}-${roundNumber}`);
      }

      const activePlayers = await this.game.getGameParticipants(gameId, true);
      const playersToEliminate = [];

      for (const participant of activePlayers) {
        const attempts = await this.game.getPlayerCurrentAttempts(gameId, participant.player_id, roundNumber);
        const guesses = await this.game.getPlayerGuesses(gameId, participant.player_id, roundNumber);
        
        const solved = guesses.some(guess => {
          const feedback = JSON.parse(guess.feedback);
          return feedback.every(f => f === 'correct');
        });

        if (!solved) {
          playersToEliminate.push(participant);
        }
      }

      for (const participant of playersToEliminate) {
        await this.game.eliminatePlayer(gameId, participant.player_id, roundNumber);
      }

      const newStats = await this.game.getGameStats(gameId);
      const remainingPlayers = await this.game.getGameParticipants(gameId, true);

      await this.broadcast(
        `⚡ *ROUND ${roundNumber} COMPLETE* ⚡\n\n` +
        `📊 *${newStats.total} started → ${newStats.active} survived*\n` +
        `❌ *${playersToEliminate.length} players eliminated*\n\n` +
        `${newStats.active > 1 ? 'Next round starting in 30 seconds...' : ''}`
      );

      if (newStats.active === 0) {
        await this.broadcast(`😔 *No winners this round!* Better luck next time!`);
        await this.game.updateGameStatus(gameId, 'completed');
      } else if (newStats.active === 1) {
        const winner = remainingPlayers[0];
        await this.declareWinner(gameId, winner);
      } else if (roundNumber >= 6) {
        await this.declareFinalRoundWinners(gameId, remainingPlayers);
      } else {
        setTimeout(() => {
          this.startRound(gameId, roundNumber + 1);
        }, 30000); // 30 seconds between rounds
      }

    } catch (error) {
      console.error('Error ending round:', error);
    }
  }

  async processGuess(telegramId, guess, chatId) {
    try {
      if (!this.currentGame || this.currentGame.status !== 'active') {
        return { success: false, message: 'No active game right now' };
      }

      if (!isValidWord(guess)) {
        return { success: false, message: 'Invalid word! Please enter a valid 5-letter word.' };
      }

      const player = await this.player.getPlayer(telegramId);
      if (!player) {
        return { success: false, message: 'You need to join the game first! Use /join' };
      }

      const participants = await this.game.getGameParticipants(this.currentGame.id);
      const participant = participants.find(p => p.player_id === player.id);
      
      if (!participant || participant.status !== 'active') {
        return { success: false, message: 'You are not in this game or have been eliminated' };
      }

      const currentRound = this.currentGame.current_round;
      const config = this.game.getRoundConfig(currentRound);
      const currentAttempts = await this.game.getPlayerCurrentAttempts(
        this.currentGame.id, 
        player.id, 
        currentRound
      );

      if (currentAttempts >= config.maxAttempts) {
        return { success: false, message: `You've used all ${config.maxAttempts} attempts for this round` };
      }

      const feedback = getWordFeedback(guess, this.currentGame.current_word);
      const formattedFeedback = formatFeedbackForTelegram(guess, feedback);
      
      await this.game.recordGuess(
        this.currentGame.id,
        player.id,
        currentRound,
        guess.toUpperCase(),
        feedback,
        currentAttempts + 1
      );

      const isCorrect = feedback.every(f => f === 'correct');
      const attemptsLeft = config.maxAttempts - (currentAttempts + 1);
      
      let response = `*Your guess:* ${guess.toUpperCase()}\n\n${formattedFeedback}\n\n`;
      
      if (isCorrect) {
        response += `🎉 *Correct!* You've solved this round!\n`;
        response += `Waiting for other players or round timer...`;
      } else if (attemptsLeft > 0) {
        response += `*Attempts remaining:* ${attemptsLeft}`;
      } else {
        response += `❌ *No attempts remaining!* You'll be eliminated if you don't solve it.`;
      }

      return { success: true, message: response };

    } catch (error) {
      console.error('Error processing guess:', error);
      return { success: false, message: 'Error processing your guess. Please try again.' };
    }
  }

  async joinGame(telegramId, username, firstName, chatId) {
    try {
      console.log(`🎮 Player joining game:`);
      console.log(`   Telegram ID: ${telegramId}`);
      console.log(`   Username: ${username || 'N/A'}`);
      console.log(`   First Name: ${firstName || 'N/A'}`);
      console.log(`   Chat ID: ${chatId}`);
      
      const player = await this.player.createOrUpdatePlayer(telegramId, username, firstName, chatId);
      console.log(`✅ Player created/updated: ID ${player.id}`);
      
      const currentGame = await this.game.getCurrentGame();
      if (!currentGame) {
        console.log(`❌ No current game found`);
        return { success: false, message: 'No upcoming games. Next game will be announced soon!' };
      }

      console.log(`🎯 Current game found: ID ${currentGame.id}, Status: ${currentGame.status}`);

      if (currentGame.status === 'active') {
        console.log(`❌ Game already active, can't join`);
        return { success: false, message: 'Game already in progress! Wait for the next one.' };
      }

      console.log(`📝 Attempting to join game ${currentGame.id}...`);
      const result = await this.game.joinGame(currentGame.id, player.id, chatId);
      console.log(`🎲 Join result: ${JSON.stringify(result)}`);
      
      if (result.success) {
        const stats = await this.game.getGameStats(currentGame.id);
        console.log(`📊 Updated stats - Total: ${stats.total}, Active: ${stats.active}`);
        
        console.log(`📡 Broadcasting join message...`);
        const safeName = cleanText(firstName || username || 'Player');
        await this.broadcast(
          `🎮 ${safeName} joined the game!\n` +
          `👥 Total players: ${stats.total}`
        );
        console.log(`✅ Join broadcast completed`);
      }

      return result;
    } catch (error) {
      console.error('❌ Error joining game:', error);
      return { success: false, message: 'Error joining game. Please try again.' };
    }
  }

  async declareWinner(gameId, winner) {
    await this.game.setWinner(gameId, winner.player_id);
    await this.player.updateGameStats(winner.player_id, true);
    
    const stats = await this.game.getGameStats(gameId);
    
    await this.broadcast(
      `🏆 *WORDLE ROYALE CHAMPION!* 🏆\n\n` +
      `🎉 *Winner:* ${winner.first_name || winner.username}\n` +
      `💰 *Prize:* $${process.env.PRIZE_AMOUNT || 100}\n\n` +
      `📊 *Final word:* ${this.currentGame.current_word}\n` +
      `👥 *Total players eliminated:* ${stats.eliminated}\n\n` +
      `🎯 *Next game:* Check announcements!`
    );

    this.currentGame = null;
  }

  async declareFinalRoundWinners(gameId, winners) {
    const winnerNames = winners.map(w => w.first_name || w.username).join(', ');
    
    for (const winner of winners) {
      await this.player.updateGameStats(winner.player_id, true);
    }
    
    await this.game.updateGameStatus(gameId, 'completed');
    
    await this.broadcast(
      `🏆 *WORDLE ROYALE CHAMPIONS!* 🏆\n\n` +
      `🎉 *Winners:* ${winnerNames}\n` +
      `💰 *Prize:* $${process.env.PRIZE_AMOUNT || 100} (shared)\n\n` +
      `📊 *Final word:* ${this.currentGame.current_word}\n` +
      `🔥 *All ${winners.length} survivors solved the final puzzle!*\n\n` +
      `🎯 *Next game:* Check announcements!`
    );

    this.currentGame = null;
  }

  async getGameStatus() {
    if (!this.currentGame) {
      return 'No active game. Next game will be announced!';
    }

    const stats = await this.game.getGameStats(this.currentGame.id);
    const config = this.game.getRoundConfig(this.currentGame.current_round);
    
    return (
      `🎯 *Current Game Status*\n\n` +
      `📊 *Round:* ${this.currentGame.current_round}/6\n` +
      `👥 *Active Players:* ${stats.active}\n` +
      `❌ *Eliminated:* ${stats.eliminated}\n` +
      `🎯 *Max Attempts:* ${config.maxAttempts}\n` +
      `⏰ *Time Limit:* ${Math.floor(config.timeLimit / 1000 / 60)} minutes\n\n` +
      `Type your 5-letter guess to play!`
    );
  }
}

module.exports = GameController;