# Deployment Guide

## Quick Start

1. **Push to GitHub**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/wordle-royale-bot.git
   git push -u origin main
   ```

2. **Deploy on Railway**
   - Go to [Railway.app](https://railway.app)
   - Connect your GitHub repository
   - Add environment variables:
     - `TELEGRAM_BOT_TOKEN`: `7770201318:AAGCqY2EAZ4Zu6o3qwJAXz-7EQ5dokvqnf4`
     - `NODE_ENV`: `production`
   - Deploy automatically

## Bot Setup

### 1. Telegram Bot Configuration
Your bot token is already configured: `7770201318:AAGCqY2EAZ4Zu6o3qwJAXz-7EQ5dokvqnf4`

### 2. Add Bot to Groups
1. Add your bot to Telegram groups
2. Make sure bot has permission to send messages
3. Bot will automatically register groups when added

### 3. Test Bot Commands
- `/start` - Welcome message
- `/join` - Join next game
- `/status` - Check current game
- `/rules` - Game rules
- `/stats` - Your statistics
- `/leaderboard` - Top players

## Game Schedule

By default, games start at 8 PM daily (UTC). You can modify this in Railway environment variables:
- `GAME_SCHEDULE_CRON`: `0 20 * * *` (8 PM daily)

## Monitoring

The bot will log to Railway console:
- Game starts and player counts
- Errors and debugging info
- Database operations

## Customization

### Game Timing
Edit `src/controllers/game.js` to modify:
- Round durations
- Attempt limits
- Time warnings

### Word Lists
Edit `src/utils/words.js` to:
- Add more valid words
- Change game word pool
- Adjust difficulty

### Prize Amount
Set `PRIZE_AMOUNT` environment variable in Railway dashboard.

## Troubleshooting

### Bot Not Responding
1. Check Railway logs for errors
2. Verify bot token is correct
3. Ensure bot has message permissions in groups

### Database Issues
- Database is automatically created on first run
- SQLite file is stored in Railway's persistent storage
- Check logs for database connection errors

### Game Not Starting
- Verify cron schedule format
- Check if players have joined
- Look for errors in game scheduling logs

## Scaling

The bot is designed to handle:
- Multiple Telegram groups simultaneously
- Hundreds of concurrent players
- Daily automated games
- Real-time message broadcasting

For higher load, consider:
- Upgrading Railway plan
- Implementing message queuing
- Database optimization

## Support

Check logs in Railway dashboard for debugging information. Most issues are related to:
1. Telegram permissions
2. Bot token configuration
3. Group setup