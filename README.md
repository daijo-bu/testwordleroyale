# Wordle Royale Telegram Bot

A competitive, elimination-style Wordle game for Telegram that can run across multiple groups simultaneously.

## Features

- **Battle Royale Style**: Players compete in elimination rounds
- **Progressive Difficulty**: Fewer attempts each round (6→5→4→3→2→1)  
- **Multi-Group Support**: Single game instance across multiple Telegram groups
- **Real-time Updates**: Live player counts, eliminations, and results
- **Statistics Tracking**: Player stats, leaderboards, and game history
- **Automated Scheduling**: Daily games at configured times

## Game Flow

1. **Round 1**: 6 attempts, 10 minutes - All players start
2. **Round 2**: 5 attempts, 8 minutes - Survivors continue  
3. **Round 3**: 4 attempts, 7 minutes
4. **Round 4**: 3 attempts, 6 minutes
5. **Round 5**: 2 attempts, 5 minutes
6. **Final Round**: 1 attempt, 5 minutes - Winner(s) take all

## Commands

### Player Commands
- `/join` - Register for the next game
- `/status` - Check current game status and your progress
- `/rules` - Display game rules
- `/stats` - View your statistics and leaderboard
- `/leaderboard` - View top players

### Admin Commands
- `/admin testgame [minutes]` - Start a test game with custom registration time
- `/admin settime <hour> [minute]` - Set daily game start time (UTC)
- `/admin setregistration <minutes>` - Set registration period duration
- `/admin setprize <amount>` - Set prize amount displayed
- `/admin gamesettings` - View current game configuration
- `/admin stopgame` - Stop current active game
- `/admin playerstats` - View player statistics
- `/admin help` - Show admin command help

## Setup

### Prerequisites
- Node.js 16+
- Telegram Bot Token

### Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
4. Add your Telegram Bot Token to `.env`
5. Start the bot:
   ```bash
   npm run dev
   ```

### Production Deployment

#### Railway Deployment

1. Push to GitHub
2. Connect your GitHub repo to Railway
3. Set environment variables in Railway dashboard:
   - `TELEGRAM_BOT_TOKEN` - Your bot token
   - `NODE_ENV=production`
4. Deploy automatically via Railway

#### Environment Variables

- `TELEGRAM_BOT_TOKEN` - Your Telegram bot token (required)
- `DATABASE_PATH` - SQLite database file path (default: ./data/wordle_royale.db)
- `GAME_SCHEDULE_CRON` - Cron schedule for games (default: 0 20 * * * - 8 PM daily)
- `REGISTRATION_MINUTES` - Registration period in minutes (default: 30)
- `PRIZE_AMOUNT` - Prize amount to display (default: 100)
- `ADMIN_TELEGRAM_IDS` - Comma-separated list of admin Telegram user IDs
- `DEBUG` - Enable debug logging (default: false)

## Bot Setup

1. Create a bot via [@BotFather](https://t.me/botfather)
2. Get your bot token
3. Add bot to your Telegram groups
4. Give bot admin permissions to send messages

## Architecture

- **SQLite Database**: Player data, games, statistics
- **Cron Scheduling**: Automated game starts
- **Multi-group Broadcasting**: Simultaneous updates across groups
- **Real-time State Management**: Game rounds, eliminations, timers

## License

MIT