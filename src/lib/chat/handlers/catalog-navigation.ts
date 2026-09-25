import { db } from '../../db';
import { whatsappService } from '../../whatsapp/service';
import { GameCategory, GamePackage, formatWhatsAppRow, formatWhatsAppButton } from '../game-catalog';
import { proceedToCreateOrderAndPayment } from './order-creation';

async function getLiveCategory(gameOrId: GameCategory | string): Promise<GameCategory | undefined> {
  // Always sync pricing cache from Mongo so admin disable/enable is reflected on WhatsApp
  await db.ensureInitialized();
  const id = typeof gameOrId === 'string' ? gameOrId : gameOrId.id;
  const code = typeof gameOrId === 'string' ? gameOrId : gameOrId.code;
  return db.getCachedCategory(id) || db.getCachedCategory(code);
}

export async function sendWelcomeAndGameList(phone: string, conversationId: string, customerName?: string): Promise<void> {
  db.setSessionState(conversationId, {
    step: 'SELECTING_GAME',
    draftOrder: { items: [] }
  });

  const nameGreeting = customerName ? ` *${customerName}*` : '';
  const welcomeHeader = '🎮 DS Dukan — Game Top-Up';
  const welcomeBody = 
`👋 আসসালামু আলাইকুম${nameGreeting}! DS Dukan-এ আপনাকে স্বাগতম।

🎮 *আমাদের সব গেম টপ-আপ এবং সাবস্ক্রিপশন সার্ভিস:*
নিচের মেনু থেকে আপনার কাঙ্ক্ষিত গেম বা সার্ভিসটি সিলেক্ট করুন। ডেলিভারি মাত্র ৫–১৫ মিনিটে! ⚡

💡 *কমান্ড টিপস:* যেকোনো সময় মেনু দেখতে */menu*, অর্ডার ট্র্যাক করতে */track* বা সহায়তার জন্য */help* লিখুন।`;

  await db.ensureInitialized();
  const categories = db.getCachedCategories();

  const sections = [
    {
      title: 'DS Dukan Game Catalog',
      rows: categories.map(cat => ({
        id: cat.id,
        title: `${cat.emoji} ${cat.title}`,
        description: cat.fullName
      }))
    }
  ];

  await whatsappService.sendInteractiveList(
    phone,
    welcomeBody,
    'গেম বেছে নিন 🎮',
    sections,
    welcomeHeader,
    'DS Dukan — 24/7 Top-Up Assistant'
  );

  await db.addMessage({
    conversationId,
    sender: 'BOT',
    content: welcomeBody,
    metadata: { type: 'interactive_game_list' }
  });
}

/**
 * Resend only the game list
 */
export async function sendGameList(phone: string, conversationId: string): Promise<void> {
  await db.ensureInitialized();
  const categories = db.getCachedCategories();

  const sections = [
    {
      title: 'DS Dukan Games',
      rows: categories.map(cat => ({
        id: cat.id,
        title: `${cat.emoji} ${cat.title}`,
        description: cat.fullName
      }))
    }
  ];

  await whatsappService.sendInteractiveList(
    phone,
    '🎮 *DS DUKAN — GAME TOP UP & SUBSCRIPTION*\n\nযেকোনো একটি গেম সিলেক্ট করুন:',
    'গেম সিলেক্ট করুন',
    sections,
    '🎮 গেম তালিকা',
    'DS Dukan Top-Up'
  );
}

/**
 * Step 1 -> Step 2: Handle game category choice and show price list + package options
 */
export async function handleGameSelection(phone: string, conversationId: string, game: GameCategory): Promise<void> {
  const liveGame = (await getLiveCategory(game)) || game;

  db.setSessionState(conversationId, {
    step: 'SELECTING_PACKAGE',
    draftOrder: {
      items: [],
      selectedGame: liveGame.code,
      selectedGameLabel: liveGame.fullName
    }
  });

  await sendPackageList(phone, conversationId, liveGame);
}

/**
 * Send the price list and package selection buttons / list for a specific game
 */
export async function sendPackageList(phone: string, conversationId: string, game: GameCategory): Promise<void> {
  // Force refresh so a just-disabled package cannot linger on a stale seed cache
  await db.ensureInitialized(true);
  const liveGame = db.getCachedCategory(game.id) || db.getCachedCategory(game.code) || game;
  const packagesToShow = (liveGame.packages || []).filter(p => p.isActive !== false);

  // Build price list text
  let priceListText = `🎮 *${liveGame.fullName} — PRICE LIST*\n\n`;
  packagesToShow.forEach((pkg) => {
    priceListText += `• *${pkg.name}* : ৳${pkg.price} Tk\n`;
  });
  priceListText += `\n⚡ ডেলিভারি সময়: ৫–১৫ মিনিট\n🎁 ওয়েবসাইট থেকে কিনলে ২% ইনস্ট্যান্ট ডিসকাউন্ট!`;

  if (packagesToShow.length === 0) {
    await whatsappService.sendInteractiveButtons(
      phone,
      `${priceListText}\n\n⚠️ এই ক্যাটাগরিতে এখন কোনো সক্রিয় প্যাকেজ নেই। অন্য সার্ভিস বেছে নিন।`,
      [{ id: 'btn_main_menu', title: '🔙 মেইন মেনু' }],
      `${liveGame.emoji} ${liveGame.title}`,
      'DS Dukan'
    );
    return;
  }

  // If game has 3 or fewer packages, send interactive quick-reply buttons
  if (packagesToShow.length <= 3) {
    const buttons = packagesToShow.map(p => formatWhatsAppButton(p));

    await whatsappService.sendInteractiveButtons(
      phone,
      `${priceListText}\n\nআপনার প্যাকেজটি বেছে নিন:`,
      buttons,
      `${liveGame.emoji} ${liveGame.title}`,
      'DS Dukan'
    );
  } else {
    // If game has >3 packages, send an Interactive List Message (supports up to 10 rows)
    const sections = [
      {
        title: `${liveGame.title} Packages`.slice(0, 24),
        rows: packagesToShow.slice(0, 10).map(pkg => formatWhatsAppRow(pkg))
      }
    ];

    await whatsappService.sendInteractiveList(
      phone,
      `${priceListText}\n\nনিচের বাটন থেকে আপনার কাঙ্ক্ষিত প্যাকেজটি সিলেক্ট করুন:`,
      'প্যাকেজ বেছে নিন 💎',
      sections,
      `${liveGame.emoji} ${liveGame.title}`,
      'DS Dukan'
    );
  }

  await db.addMessage({
    conversationId,
    sender: 'BOT',
    content: priceListText,
    metadata: { type: 'price_list', game: liveGame.code }
  });
}

/**
 * Step 2 -> Step 3: Handle package choice and ask for UID / Player Info
 */
export async function handlePackageSelection(
  phone: string,
  conversationId: string,
  game: GameCategory,
  pkg: GamePackage
): Promise<void> {
  await db.ensureInitialized(true);
  const liveGame = db.getCachedCategory(game.id) || db.getCachedCategory(game.code) || game;
  const product = await db.getProductById(pkg.id);
  const livePkg =
    (liveGame.packages || []).find(p => p.id === pkg.id) ||
    (product && product.isActive !== false
      ? {
          id: product.id,
          name: product.name,
          amount: product.amount,
          price: product.price,
          basePrice: product.basePrice,
          description: product.description,
          isActive: product.isActive
        }
      : undefined);

  if (!product || product.isActive === false || !livePkg) {
    await whatsappService.sendMessage(
      phone,
      '⚠️ এই প্যাকেজটি এখন আর সক্রিয় নেই। অনুগ্রহ করে অন্য প্যাকেজ বেছে নিন।'
    );
    await sendPackageList(phone, conversationId, liveGame);
    return;
  }

  const draftOrder = {
    items: [{
      skuOrName: livePkg.name,
      packageId: livePkg.id,
      quantity: 1,
      unitPrice: livePkg.price,
      productName: `${liveGame.fullName} (${livePkg.name})`
    }],
    totalAmount: livePkg.price,
    selectedGame: liveGame.code,
    selectedGameLabel: liveGame.fullName
  };

  // Check if this is a Netflix or Crunchyroll package (no client info needed — direct WhatsApp account delivery)
  const isNetflix = livePkg.id.includes('netflix') || 
                    livePkg.name.toLowerCase().includes('netflix') || 
                    (liveGame.id === 'game_movie' && livePkg.name.toLowerCase().includes('netflix'));
  const isCrunchyroll = livePkg.id.includes('crunchyroll') || 
                        livePkg.name.toLowerCase().includes('crunchyroll') || 
                        (liveGame.id === 'game_movie' && livePkg.name.toLowerCase().includes('crunchyroll'));

  if (isNetflix || isCrunchyroll) {
    const sessionState = {
      step: 'AWAITING_PAYMENT' as const,
      lastInteractionTimestamp: Date.now(),
      draftOrder: {
        ...draftOrder,
        playerUid: 'WhatsApp Delivery'
      }
    };
    db.setSessionState(conversationId, sessionState);

    await proceedToCreateOrderAndPayment(
      phone,
      conversationId,
      'WhatsApp Delivery',
      '',
      sessionState
    );
    return;
  }

  db.setSessionState(conversationId, {
    step: 'COLLECTING_UID',
    draftOrder
  });

  const isYouTube = livePkg.id.includes('youtube') || livePkg.name.toLowerCase().includes('youtube');
  const inputInstruction = isYouTube
    ? '▶️ আপনার *Email / Gmail অ্যাড্রেস* লিখে পাঠান (যেখানে YouTube Premium সাবস্ক্রিপশন নিতে চান):'
    : liveGame.inputPrompt;

  const promptMessage = 
`✅ *সিলেক্টেড প্যাকেজ:* ${livePkg.name}
💰 *মূল্য:* ৳${livePkg.price} Tk

${inputInstruction}`;

  const buttons = [
    { id: 'btn_main_menu', title: '🔙 মেইন মেনু' }
  ];

  await whatsappService.sendInteractiveButtons(
    phone,
    promptMessage,
    buttons,
    'আইডি তথ্য দিন'
  );

  await db.addMessage({
    conversationId,
    sender: 'BOT',
    content: promptMessage,
    metadata: { step: 'COLLECTING_UID', package: livePkg.name, price: livePkg.price }
  });
}
