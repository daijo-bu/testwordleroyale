require('dotenv').config();

async function resetTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN not found in environment');
    process.exit(1);
  }

  console.log('🔄 Resetting Telegram bot connection...');

  try {
    // Delete webhook (if any)
    console.log('1. Deleting webhook...');
    const deleteWebhookResponse = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
      method: 'POST'
    });
    const deleteResult = await deleteWebhookResponse.json();
    console.log('   Webhook delete result:', deleteResult.ok ? '✅ Success' : '❌ Failed');

    // Get current updates to clear the queue
    console.log('2. Getting pending updates...');
    const getUpdatesResponse = await fetch(`https://api.telegram.org/bot${token}/getUpdates?timeout=1`, {
      method: 'POST'
    });
    const updatesResult = await getUpdatesResponse.json();
    console.log(`   Found ${updatesResult.result?.length || 0} pending updates`);

    // Clear updates queue with high offset
    if (updatesResult.result && updatesResult.result.length > 0) {
      const lastUpdateId = updatesResult.result[updatesResult.result.length - 1].update_id;
      console.log('3. Clearing updates queue...');
      const clearResponse = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=1`, {
        method: 'POST'
      });
      const clearResult = await clearResponse.json();
      console.log('   Queue clear result:', clearResult.ok ? '✅ Success' : '❌ Failed');
    }

    // Check bot info
    console.log('4. Verifying bot connection...');
    const getMeResponse = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const botInfo = await getMeResponse.json();
    
    if (botInfo.ok) {
      console.log(`✅ Bot connection verified: @${botInfo.result.username}`);
      console.log('🎉 Reset complete! You can now start the bot.');
    } else {
      console.log('❌ Bot verification failed:', botInfo.description);
    }

  } catch (error) {
    console.error('❌ Reset failed:', error.message);
    process.exit(1);
  }
}

resetTelegramBot();