# Admin Configuration Guide

## Setting Up Admin Access

### 1. Get Your Telegram User ID

To use admin commands, you need to add your Telegram User ID to the bot's configuration.

**Method 1: Using @userinfobot**
1. Start a chat with [@userinfobot](https://t.me/userinfobot) 
2. Send any message
3. It will reply with your user ID (a number like `123456789`)

**Method 2: Using @raw_data_bot**
1. Start a chat with [@raw_data_bot](https://t.me/raw_data_bot)
2. Send any message
3. Look for `"id": 123456789` in the response

### 2. Configure Admin Access

**In Railway Dashboard:**
1. Go to your Railway project
2. Click "Variables" tab
3. Add environment variable:
   - Name: `ADMIN_TELEGRAM_IDS`
   - Value: `YOUR_USER_ID` (e.g., `123456789`)
   - For multiple admins: `123456789,987654321,555111222`

**In Local Development:**
Edit your `.env` file:
```
ADMIN_TELEGRAM_IDS=123456789
```

### 3. Restart the Bot
- Railway: Will restart automatically when you add the environment variable
- Local: Restart your `npm start` process

## Admin Commands Reference

### Game Control
```
/admin testgame [minutes]     # Start test game (default: 2 minutes registration)
/admin stopgame              # Stop current active game
```

**Examples:**
- `/admin testgame` - Test game with 2-minute registration
- `/admin testgame 5` - Test game with 5-minute registration
- `/admin testgame 1` - Quick 1-minute test

### Configuration
```
/admin settime <hour> [minute]        # Set daily game time (UTC)
/admin setregistration <minutes>      # Set registration period
/admin setprize <amount>             # Set prize amount
```

**Examples:**
- `/admin settime 21` - Games at 9:00 PM UTC
- `/admin settime 19 30` - Games at 7:30 PM UTC  
- `/admin setregistration 45` - 45 minutes to register
- `/admin setprize 200` - $200 prize display

### Information
```
/admin gamesettings          # View current configuration
/admin playerstats          # View player statistics
/admin help                 # Show command help
```

## Time Zone Conversion

The bot uses UTC time. Convert your local time:

**Common Conversions:**
- EST (UTC-5): 8 PM EST = 1 AM UTC next day (`1 0 * * *`)
- PST (UTC-8): 8 PM PST = 4 AM UTC next day (`0 4 * * *`)
- GMT (UTC+0): 8 PM GMT = 8 PM UTC (`0 20 * * *`)
- CET (UTC+1): 8 PM CET = 7 PM UTC (`0 19 * * *`)

## Typical Admin Workflow

### Setting Up Regular Games
1. **Set your preferred time:**
   ```
   /admin settime 20 0    # 8:00 PM UTC daily
   ```

2. **Configure registration period:**
   ```
   /admin setregistration 30    # 30 minutes to join
   ```

3. **Set prize amount:**
   ```
   /admin setprize 100    # $100 prize
   ```

### Running Test Games
1. **Quick test (2 minutes):**
   ```
   /admin testgame
   ```

2. **Longer test for debugging:**
   ```
   /admin testgame 10
   ```

3. **Check if players joined:**
   ```
   /admin gamesettings
   ```

### Managing Active Games
1. **Check current status:**
   ```
   /admin gamesettings
   ```

2. **Stop if needed:**
   ```
   /admin stopgame
   ```

3. **View participation:**
   ```
   /admin playerstats
   ```

## Security Notes

- Only users in `ADMIN_TELEGRAM_IDS` can use admin commands
- Admin commands work in any chat (groups or private messages)
- Test games don't affect official statistics
- Changes to schedule take effect immediately
- Prize amount changes are cosmetic (display only)

## Troubleshooting

**"Access denied" message:**
- Verify your Telegram User ID is correct
- Check `ADMIN_TELEGRAM_IDS` environment variable in Railway
- Restart the bot after adding your ID

**Commands not working:**
- Make sure you're using the exact format: `/admin command args`
- Check Railway logs for error messages
- Verify bot is running and responsive

**Test games not starting:**
- Check if another game is already active
- Use `/admin stopgame` to clear any stuck games
- Verify players are joining with `/join`

## Multiple Admins

To add multiple administrators:
```
ADMIN_TELEGRAM_IDS=123456789,987654321,555111222
```

Each admin has full access to all commands.