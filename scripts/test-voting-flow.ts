/**
 * Integration test for voting flow
 * Tests the complete user journey:
 * 1. Create suggestion
 * 2. Vote on suggestion
 * 3. Check vote status
 * 4. Remove vote
 * 5. Update trending scores
 */

const TEST_WALLET = '0xtest123';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testVotingFlow() {
  console.log('🧪 Testing voting flow...\n');

  // 1. Create suggestion
  console.log('1️⃣ Creating suggestion...');
  const createResponse = await fetch(`${BASE_URL}/api/suggestions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-wallet-address': TEST_WALLET,
    },
    body: JSON.stringify({
      customCityName: 'Test City',
      latitude: 40.7128,
      longitude: -74.0060,
      timeWindow: 'MORNING',
      comment: 'This would be a great market!',
    }),
  });

  if (!createResponse.ok) {
    throw new Error(`Failed to create suggestion: ${await createResponse.text()}`);
  }

  const suggestion = await createResponse.json();
  console.log(`✅ Created suggestion: ${suggestion.id}\n`);

  // 2. List suggestions
  console.log('2️⃣ Listing suggestions...');
  const listResponse = await fetch(`${BASE_URL}/api/suggestions?sort=recent`);
  const listData = await listResponse.json();
  console.log(`✅ Found ${listData.suggestions.length} suggestions\n`);

  // 3. Vote on suggestion
  console.log('3️⃣ Casting vote...');
  const voteResponse = await fetch(`${BASE_URL}/api/suggestions/${suggestion.id}/vote`, {
    method: 'POST',
    headers: {
      'x-wallet-address': '0xvoter1',
    },
  });

  if (!voteResponse.ok) {
    throw new Error(`Failed to vote: ${await voteResponse.text()}`);
  }
  console.log('✅ Vote cast successfully\n');

  // 4. Check vote status
  console.log('4️⃣ Checking vote status...');
  const votedResponse = await fetch(`${BASE_URL}/api/suggestions/${suggestion.id}/voted`, {
    headers: {
      'x-wallet-address': '0xvoter1',
    },
  });
  const votedData = await votedResponse.json();

  if (!votedData.voted) {
    throw new Error('Vote status check failed');
  }
  console.log('✅ Vote status confirmed\n');

  // 5. Try duplicate vote (should fail)
  console.log('5️⃣ Testing duplicate vote prevention...');
  const duplicateResponse = await fetch(`${BASE_URL}/api/suggestions/${suggestion.id}/vote`, {
    method: 'POST',
    headers: {
      'x-wallet-address': '0xvoter1',
    },
  });

  if (duplicateResponse.ok) {
    throw new Error('Duplicate vote was allowed!');
  }
  console.log('✅ Duplicate vote prevented\n');

  // 6. Get suggestion details
  console.log('6️⃣ Getting suggestion details...');
  const detailResponse = await fetch(`${BASE_URL}/api/suggestions/${suggestion.id}`);
  const details = await detailResponse.json();

  if (details.voteCount !== 1) {
    throw new Error(`Expected voteCount=1, got ${details.voteCount}`);
  }
  console.log('✅ Vote count updated correctly\n');

  // 7. Remove vote
  console.log('7️⃣ Removing vote...');
  const removeResponse = await fetch(`${BASE_URL}/api/suggestions/${suggestion.id}/vote`, {
    method: 'DELETE',
    headers: {
      'x-wallet-address': '0xvoter1',
    },
  });

  if (!removeResponse.ok) {
    throw new Error(`Failed to remove vote: ${await removeResponse.text()}`);
  }
  console.log('✅ Vote removed successfully\n');

  // 8. Update trending scores
  console.log('8️⃣ Updating trending scores...');
  const trendingResponse = await fetch(`${BASE_URL}/api/cron/update-trending`);
  const trendingData = await trendingResponse.json();
  console.log(`✅ Updated ${trendingData.updated} suggestions in ${trendingData.duration}ms\n`);

  console.log('🎉 All tests passed!');
}

testVotingFlow().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
