class Game {
  constructor(database) {
    this.db = database;
    this.roundConfig = [
      { round: 1, maxAttempts: 6, timeLimit: 10 * 60 * 1000 }, // 10 minutes
      { round: 2, maxAttempts: 5, timeLimit: 8 * 60 * 1000 },  // 8 minutes
      { round: 3, maxAttempts: 4, timeLimit: 7 * 60 * 1000 },  // 7 minutes
      { round: 4, maxAttempts: 3, timeLimit: 6 * 60 * 1000 },  // 6 minutes
      { round: 5, maxAttempts: 2, timeLimit: 5 * 60 * 1000 },  // 5 minutes
      { round: 6, maxAttempts: 1, timeLimit: 5 * 60 * 1000 }   // Final: 5 minutes
    ];
  }

  async createGame(startTime) {
    const sql = `INSERT INTO games (start_time, status) VALUES (?, 'scheduled')`;
    const result = await this.db.run(sql, [startTime]);
    return result.id;
  }

  async getGame(gameId) {
    const sql = `SELECT * FROM games WHERE id = ?`;
    return this.db.get(sql, [gameId]);
  }

  async getCurrentGame() {
    const sql = `SELECT * FROM games WHERE status IN ('active', 'scheduled') ORDER BY start_time DESC LIMIT 1`;
    return this.db.get(sql);
  }

  async updateGameStatus(gameId, status) {
    const sql = `UPDATE games SET status = ? WHERE id = ?`;
    return this.db.run(sql, [status, gameId]);
  }

  async setGameWord(gameId, word) {
    const sql = `UPDATE games SET current_word = ? WHERE id = ?`;
    return this.db.run(sql, [word, gameId]);
  }

  async updateRound(gameId, round) {
    const sql = `UPDATE games SET current_round = ? WHERE id = ?`;
    return this.db.run(sql, [round, gameId]);
  }

  async updatePlayerCounts(gameId, totalPlayers, activePlayers) {
    const sql = `UPDATE games SET total_players = ?, active_players = ? WHERE id = ?`;
    return this.db.run(sql, [totalPlayers, activePlayers, gameId]);
  }

  async setWinner(gameId, winnerId) {
    const sql = `UPDATE games SET winner_id = ?, status = 'completed' WHERE id = ?`;
    return this.db.run(sql, [winnerId, gameId]);
  }

  async joinGame(gameId, playerId, chatId) {
    const checkSql = `SELECT id FROM game_participants WHERE game_id = ? AND player_id = ?`;
    const existing = await this.db.get(checkSql, [gameId, playerId]);
    
    if (existing) {
      console.log(`⚠️  Player ${playerId} already registered for game ${gameId}`);
      return { success: false, message: 'Already registered for this game' };
    }

    console.log(`📝 Adding player ${playerId} to game ${gameId} participants`);
    const sql = `INSERT INTO game_participants (game_id, player_id, chat_id) VALUES (?, ?, ?)`;
    await this.db.run(sql, [gameId, playerId, chatId]);
    console.log(`✅ Player ${playerId} successfully added to game ${gameId}`);
    
    return { success: true, message: 'Successfully joined the game!' };
  }

  async getGameParticipants(gameId, activeOnly = false) {
    let sql = `
      SELECT gp.*, p.telegram_id, p.username, p.first_name 
      FROM game_participants gp 
      JOIN players p ON gp.player_id = p.id 
      WHERE gp.game_id = ?
    `;
    
    if (activeOnly) {
      sql += ` AND gp.status = 'active'`;
    }
    
    return this.db.all(sql, [gameId]);
  }

  async eliminatePlayer(gameId, playerId, round) {
    const sql = `UPDATE game_participants SET status = 'eliminated', eliminated_round = ? 
                 WHERE game_id = ? AND player_id = ?`;
    return this.db.run(sql, [round, gameId, playerId]);
  }

  async recordGuess(gameId, playerId, round, guess, feedback, attemptNumber) {
    const sql = `INSERT INTO guesses (game_id, player_id, round_number, guess, feedback, attempt_number) 
                 VALUES (?, ?, ?, ?, ?, ?)`;
    return this.db.run(sql, [gameId, playerId, round, guess, JSON.stringify(feedback), attemptNumber]);
  }

  async getPlayerCurrentAttempts(gameId, playerId, round) {
    const sql = `SELECT COUNT(*) as count FROM guesses 
                 WHERE game_id = ? AND player_id = ? AND round_number = ?`;
    const result = await this.db.get(sql, [gameId, playerId, round]);
    return result.count;
  }

  async updatePlayerAttempts(gameId, playerId, attempts) {
    const sql = `UPDATE game_participants SET current_attempts = ? 
                 WHERE game_id = ? AND player_id = ?`;
    return this.db.run(sql, [attempts, gameId, playerId]);
  }

  async getPlayerGuesses(gameId, playerId, round) {
    const sql = `SELECT * FROM guesses 
                 WHERE game_id = ? AND player_id = ? AND round_number = ? 
                 ORDER BY attempt_number`;
    return this.db.all(sql, [gameId, playerId, round]);
  }

  getRoundConfig(round) {
    return this.roundConfig.find(config => config.round === round) || this.roundConfig[0];
  }

  async getGameStats(gameId) {
    const totalSql = `SELECT COUNT(*) as total FROM game_participants WHERE game_id = ?`;
    const activeSql = `SELECT COUNT(*) as active FROM game_participants WHERE game_id = ? AND status = 'active'`;
    const eliminatedSql = `SELECT COUNT(*) as eliminated FROM game_participants WHERE game_id = ? AND status = 'eliminated'`;
    
    const [total, active, eliminated] = await Promise.all([
      this.db.get(totalSql, [gameId]),
      this.db.get(activeSql, [gameId]),
      this.db.get(eliminatedSql, [gameId])
    ]);
    
    return {
      total: total.total,
      active: active.active,
      eliminated: eliminated.eliminated
    };
  }
}

module.exports = Game;