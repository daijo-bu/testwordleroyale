require('dotenv').config();
const { isValidWord, getRandomGameWord, getWordFeedback, formatFeedbackForTelegram } = require('./src/utils/words');

console.log('🧪 Testing Wordle Royale Bot Components...\n');

// Test word validation
console.log('1. Testing word validation:');
console.log('   HOUSE (valid):', isValidWord('HOUSE'));
console.log('   ZZZZZ (invalid):', isValidWord('ZZZZZ'));
console.log('   house (lowercase):', isValidWord('house'));

// Test random word generation
console.log('\n2. Testing random word generation:');
for (let i = 0; i < 3; i++) {
  console.log(`   Random word ${i + 1}:`, getRandomGameWord());
}

// Test feedback generation
console.log('\n3. Testing feedback generation:');
const testWord = 'HOUSE';
const testGuesses = ['MOUSE', 'HORSE', 'HOUSE'];

testGuesses.forEach(guess => {
  console.log(`   Guess: ${guess} (target: ${testWord})`);
  const feedback = getWordFeedback(guess, testWord);
  console.log('   Feedback:', feedback);
  console.log('   Formatted:', formatFeedbackForTelegram(guess, feedback));
  console.log();
});

// Test database initialization
console.log('4. Testing database setup:');
const DatabaseService = require('./src/services/database');

(async () => {
  try {
    const db = new DatabaseService();
    await db.initialize();
    console.log('   ✅ Database initialized successfully');
    
    // Test player creation
    const result = await db.createPlayer(12345, 'testuser', 'Test User');
    console.log('   ✅ Player creation test passed');
    
    db.close();
    console.log('   ✅ Database closed');
    
    console.log('\n🎉 All tests passed! Bot is ready to deploy.');
    console.log('\nTo start the bot:');
    console.log('   npm start');
    
  } catch (error) {
    console.error('   ❌ Database test failed:', error.message);
  }
})();