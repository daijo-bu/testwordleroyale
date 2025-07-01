class Player {
  constructor(database) {
    this.db = database;
  }

  async createOrUpdatePlayer(telegramId, username, firstName, chatId = null) {
    let player = await this.getPlayer(telegramId);
    
    if (!player) {
      const result = await this.db.createPlayer(telegramId, username, firstName);
      player = await this.getPlayer(telegramId);
    } else {
      await this.updatePlayerInfo(player.id, username, firstName);
      player = await this.getPlayer(telegramId);
    }

    if (chatId) {
      await this.registerChatGroup(chatId);
    }

    return player;
  }

  async getPlayer(telegramId) {
    return this.db.getPlayer(telegramId);
  }

  async updatePlayerInfo(playerId, username, firstName) {
    const sql = `UPDATE players SET username = ?, first_name = ? WHERE id = ?`;
    return this.db.run(sql, [username, firstName, playerId]);
  }

  async getPlayerStats(telegramId) {
    const sql = `
      SELECT 
        p.*,
        COUNT(DISTINCT gp.game_id) as games_participated,
        COUNT(DISTINCT CASE WHEN g.winner_id = p.id THEN g.id END) as games_won,
        AVG(CASE WHEN gp.eliminated_round IS NOT NULL THEN gp.eliminated_round ELSE 7 END) as avg_elimination_round
      FROM players p
      LEFT JOIN game_participants gp ON p.id = gp.player_id
      LEFT JOIN games g ON gp.game_id = g.id AND g.status = 'completed'
      WHERE p.telegram_id = ?
      GROUP BY p.id
    `;
    
    return this.db.get(sql, [telegramId]);
  }

  async registerChatGroup(chatId, chatTitle = null) {
    const checkSql = `SELECT id FROM chat_groups WHERE chat_id = ?`;
    const existing = await this.db.get(checkSql, [chatId]);
    
    if (!existing) {
      const sql = `INSERT INTO chat_groups (chat_id, chat_title) VALUES (?, ?)`;
      await this.db.run(sql, [chatId, chatTitle]);
    } else if (chatTitle) {
      const updateSql = `UPDATE chat_groups SET chat_title = ? WHERE chat_id = ?`;
      await this.db.run(updateSql, [chatTitle, chatId]);
    }
  }

  async getActiveChatGroups() {
    const sql = `SELECT * FROM chat_groups WHERE is_active = 1`;
    return this.db.all(sql);
  }

  async deactivateChatGroup(chatId) {
    const sql = `UPDATE chat_groups SET is_active = 0 WHERE chat_id = ?`;
    return this.db.run(sql, [chatId]);
  }

  async getLeaderboard(limit = 10) {
    const sql = `
      SELECT 
        p.username,
        p.first_name,
        p.wins,
        p.total_games,
        ROUND((p.wins * 100.0 / CASE WHEN p.total_games = 0 THEN 1 ELSE p.total_games END), 1) as win_rate,
        AVG(CASE WHEN gp.eliminated_round IS NOT NULL THEN gp.eliminated_round ELSE 7 END) as avg_round_reached
      FROM players p
      LEFT JOIN game_participants gp ON p.id = gp.player_id
      WHERE p.total_games > 0
      GROUP BY p.id
      ORDER BY p.wins DESC, win_rate DESC, avg_round_reached DESC
      LIMIT ?
    `;
    
    return this.db.all(sql, [limit]);
  }

  async updateGameStats(playerId, isWinner = false) {
    return this.db.updatePlayerStats(playerId, isWinner);
  }

  async getPlayerGameHistory(telegramId, limit = 5) {
    const sql = `
      SELECT 
        g.id as game_id,
        g.start_time,
        g.status,
        g.current_round,
        gp.status as player_status,
        gp.eliminated_round,
        CASE WHEN g.winner_id = p.id THEN 1 ELSE 0 END as is_winner
      FROM players p
      JOIN game_participants gp ON p.id = gp.player_id
      JOIN games g ON gp.game_id = g.id
      WHERE p.telegram_id = ?
      ORDER BY g.start_time DESC
      LIMIT ?
    `;
    
    return this.db.all(sql, [telegramId, limit]);
  }
}

module.exports = Player;