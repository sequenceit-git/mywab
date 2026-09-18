import { db } from '../src/lib/db';

async function testLeaderboard() {
  console.log('🧪 Testing Users Leaderboard Aggregation...\n');

  // Seed sample users with orders if needed
  const u1 = await db.getOrCreateUser('+8801811111111', 'Ovijit VIP');
  await db.updateUserStatus(u1.id, 'VIP');

  const u2 = await db.getOrCreateUser('+8801822222222', 'Rifat Pro');
  const u3 = await db.getOrCreateUser('+8801833333333', 'Saif Gamer');

  await db.createOrder({
    userId: u1.id,
    deliveryPhone: '+8801811111111',
    playerUid: '5123984712',
    trxId: 'TXN-VIP-001',
    items: [{ product_name: 'PUBG MOBILE — UID TOP UP (1045 UC)', unit_price: 1850, quantity: 2 }]
  });

  await db.createOrder({
    userId: u2.id,
    deliveryPhone: '+8801822222222',
    playerUid: '876543210',
    trxId: 'TXN-REG-002',
    items: [{ product_name: 'FREE FIRE (610 Diamonds)', unit_price: 470, quantity: 1 }]
  });

  const leaderboard = await db.getUsersLeaderboard();
  console.log(`✅ Retrieved ${leaderboard.length} customers in leaderboard:\n`);

  leaderboard.forEach(entry => {
    console.log(
      `Rank #${entry.rank} | ${entry.name || 'Anonymous'} (${entry.phone_number}) | Tag: [${entry.status_tag}] | Total Spent: ৳${entry.total_spent} | Orders: ${entry.total_orders} | UID: ${entry.latest_uid || 'N/A'}`
    );
  });

  if (leaderboard.length === 0) throw new Error('Leaderboard is empty');
  if (leaderboard[0].rank !== 1) throw new Error('Rank #1 assignment failed');

  console.log('\n🎉 Users Leaderboard test passed successfully!');
}

testLeaderboard().catch(err => {
  console.error('❌ Leaderboard test failed:', err);
  process.exit(1);
});
