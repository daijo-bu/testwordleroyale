require('dotenv').config();

async function forceResetBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN not found');
    process.exit(1);
  }

  console.log('🔄 Force resetting Telegram bot...');

  try {
    // 1. Delete webhook aggressively
    console.log('1. Force deleting webhook...');
    await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`, {
      method: 'POST'
    });

    // 2. Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. Get and clear ALL pending updates
    console.log('2. Clearing all pending updates...');
    let offset = 0;
    for (let i = 0; i < 10; i++) {
      const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=1`, {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.ok && result.result.length > 0) {
        offset = result.result[result.result.length - 1].update_id + 1;
        console.log(`   Cleared ${result.result.length} updates (offset: ${offset})`);
      } else {
        console.log('   ✅ No more pending updates');
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 4. Final cleanup call
    console.log('3. Final cleanup...');
    await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${offset + 1000}&timeout=1`, {
      method: 'POST'
    });

    // 5. Verify bot status
    console.log('4. Verifying bot...');
    const getMeResponse = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const botInfo = await getMeResponse.json();
    
    if (botInfo.ok) {
      console.log(`✅ Bot verified: @${botInfo.result.username}`);
      console.log('🎉 Force reset complete!');
    } else {
      throw new Error('Bot verification failed');
    }

  } catch (error) {
    console.error('❌ Force reset failed:', error.message);
    process.exit(1);
  }
}

forceResetBot();