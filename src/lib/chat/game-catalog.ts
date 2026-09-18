export interface GamePackage {
  id: string;          // Button/selection ID e.g. 'pkg_pubg_60uc'
  name: string;        // e.g. '60 UC'
  price: number;       // Selling price e.g. 115
  basePrice?: number;  // Cost / Wholesale Base Price for profit calculation e.g. 95
  description?: string;
}

export interface GameCategory {
  id: string;          // e.g. 'game_pubg_uid'
  code: string;        // Short code e.g. 'pubg_uid'
  title: string;       // e.g. 'PUBG Mobile — UID'
  fullName: string;    // e.g. 'PUBG MOBILE — UID TOP UP'
  emoji: string;       // e.g. '🎮'
  requiresUid: boolean;
  inputPrompt: string; // What to ask the user for (UID, Email, QR confirmation)
  inputLabel: string;  // e.g. 'Player UID', 'Konami ID / Email', etc.
  packages: GamePackage[];
}

export const GAME_CATEGORIES: GameCategory[] = [
  {
    id: 'game_pubg_uid',
    code: 'pubg_uid',
    title: 'PUBG — UID TOP UP',
    fullName: 'PUBG MOBILE — UID TOP UP',
    emoji: '🎮',
    requiresUid: true,
    inputLabel: 'Player UID',
    inputPrompt: '🎮 আপনার *PUBG Player UID* টি লিখে পাঠান (যেমন: `5123456789`):',
    packages: [
      { id: 'pkg_pubg_60', name: '60 UC', price: 115, basePrice: 95, description: 'Direct In-Game Top-Up' },
      { id: 'pkg_pubg_120', name: '120 UC', price: 230, basePrice: 190, description: 'Direct In-Game Top-Up' },
      { id: 'pkg_pubg_180', name: '180 UC', price: 340, basePrice: 285, description: 'Direct In-Game Top-Up' },
      { id: 'pkg_pubg_325', name: '325 UC', price: 600, basePrice: 495, description: 'Direct In-Game Top-Up' },
      { id: 'pkg_pubg_385', name: '385 UC [50 RP]', price: 710, basePrice: 590, description: 'Royale Pass 50 RP Pack' },
      { id: 'pkg_pubg_660', name: '660 UC', price: 1150, basePrice: 960, description: 'Direct In-Game Top-Up' },
      { id: 'pkg_pubg_720', name: '720 UC [100 RP]', price: 1250, basePrice: 1040, description: 'Royale Pass 100 RP Pack' },
      { id: 'pkg_pubg_1045', name: '1045 UC', price: 1850, basePrice: 1550, description: 'Direct In-Game Top-Up' },
      { id: 'pkg_pubg_1800', name: '1800 UC', price: 3150, basePrice: 2620, description: 'Mega Pack Top-Up' },
      { id: 'pkg_pubg_3850', name: '3850 UC', price: 6500, basePrice: 5400, description: 'Super Mega Pack' }
    ]
  },
  {
    id: 'game_pubg_login',
    code: 'pubg_login',
    title: 'PUBG — LOGIN UC (QR)',
    fullName: 'PUBG MOBILE — LOGIN UC ( QR )',
    emoji: '📲',
    requiresUid: false,
    inputLabel: 'Phone / Account Info',
    inputPrompt: '📲 আপনার *WhatsApp নম্বর বা অ্যাকাউন্ট তথ্য* লিখে পাঠান (টপ-আপের সময় আমাদের এজেন্ট QR কোড দিয়ে লগইন করে দেবেন):',
    packages: [
      { id: 'pkg_login_325', name: '300+25 UC (QR)', price: 520, basePrice: 420, description: 'QR Code Login Top-Up' },
      { id: 'pkg_login_660', name: '600+60 UC (QR)', price: 1000, basePrice: 820, description: 'QR Code Login Top-Up' },
      { id: 'pkg_login_1800', name: '1500+300 UC (QR)', price: 2450, basePrice: 2000, description: 'QR Code Login Top-Up' },
      { id: 'pkg_login_3850', name: '3000+850 UC (QR)', price: 4850, basePrice: 3950, description: 'QR Code Login Top-Up' },
      { id: 'pkg_login_8100', name: '6000+2100 UC (QR)', price: 9400, basePrice: 7700, description: 'QR Code Login Top-Up' }
    ]
  },
  {
    id: 'game_pubg_sub',
    code: 'pubg_sub',
    title: 'PUBG — SUBSCRIPTION',
    fullName: 'PUBG MOBILE — SUBSCRIPTION PACK',
    emoji: '👑',
    requiresUid: true,
    inputLabel: 'Player UID',
    inputPrompt: '👑 আপনার *PUBG Player UID* টি লিখে পাঠান:',
    packages: [
      { id: 'pkg_sub_prime', name: 'Prime (1 Month)', price: 150, basePrice: 110, description: 'Instant UID Activation' },
      { id: 'pkg_sub_prime_plus', name: 'Prime Plus (1 Month)', price: 1150, basePrice: 930, description: 'Instant UID Activation' }
    ]
  },
  {
    id: 'game_pubg_kr',
    code: 'pubg_kr',
    title: 'PUBG KR — KOREAN UC',
    fullName: 'PUBG MOBILE KR — KOREAN UC',
    emoji: '🇰🇷',
    requiresUid: true,
    inputLabel: 'Player UID',
    inputPrompt: '🇰🇷 আপনার *PUBG Korean (KR) Player UID* টি লিখে পাঠান:',
    packages: [
      { id: 'pkg_kr_60', name: '60 KR UC', price: 130, basePrice: 105, description: 'PUBG KR UID Top-Up' },
      { id: 'pkg_kr_180', name: '180 KR UC', price: 390, basePrice: 315, description: 'PUBG KR UID Top-Up' },
      { id: 'pkg_kr_360', name: '360 KR UC', price: 750, basePrice: 610, description: 'PUBG KR UID Top-Up' },
      { id: 'pkg_kr_660', name: '660 KR UC', price: 1350, basePrice: 1100, description: 'PUBG KR UID Top-Up' },
      { id: 'pkg_kr_1200', name: '1200 KR UC', price: 2400, basePrice: 1950, description: 'PUBG KR UID Top-Up' }
    ]
  },
  {
    id: 'game_pubg_special',
    code: 'pubg_special',
    title: 'PUBG SPECIAL — QR UC',
    fullName: 'PUBG MOBILE SPECIAL LOGIN — QR UC',
    emoji: '⭐',
    requiresUid: false,
    inputLabel: 'Account Info / Contact',
    inputPrompt: '⭐ আপনার *অ্যাকাউন্ট রেফারেন্স বা ফোন নম্বর* লিখে দিন:',
    packages: [
      { id: 'pkg_spec_1', name: 'Special Pack 1 (QR)', price: 450, basePrice: 360, description: 'Special Login QR UC' },
      { id: 'pkg_spec_2', name: 'Special Pack 2 (QR)', price: 890, basePrice: 710, description: 'Special Login QR UC' },
      { id: 'pkg_spec_3', name: 'Special Pack 3 (QR)', price: 1750, basePrice: 1400, description: 'Special Login QR UC' }
    ]
  },
  {
    id: 'game_efb_android',
    code: 'efb_android',
    title: 'EFOOTBALL — ANDROID',
    fullName: 'EFOOTBALL — ANDROID COINS',
    emoji: '⚽',
    requiresUid: false,
    inputLabel: 'Konami ID / Email',
    inputPrompt: '⚽ আপনার *Konami ID (Email/Username)* লিখে পাঠান:',
    packages: [
      { id: 'pkg_efb_and_130', name: '130 Coins (Android)', price: 140, basePrice: 110, description: 'Android In-Game Coins' },
      { id: 'pkg_efb_and_260', name: '260 Coins (Android)', price: 280, basePrice: 225, description: 'Android In-Game Coins' },
      { id: 'pkg_efb_and_550', name: '550 Coins (Android)', price: 580, basePrice: 465, description: 'Android In-Game Coins' },
      { id: 'pkg_efb_and_1050', name: '1050 Coins (Android)', price: 1090, basePrice: 880, description: 'Android In-Game Coins' },
      { id: 'pkg_efb_and_2130', name: '2130 Coins (Android)', price: 2150, basePrice: 1730, description: 'Android In-Game Coins' }
    ]
  },
  {
    id: 'game_efb_ios',
    code: 'efb_ios',
    title: 'EFOOTBALL — iOS COINS',
    fullName: 'EFOOTBALL — iOS COINS',
    emoji: '🍏',
    requiresUid: false,
    inputLabel: 'Konami ID / Apple ID Email',
    inputPrompt: '🍏 আপনার *Konami ID বা Apple ID Email* লিখে পাঠান:',
    packages: [
      { id: 'pkg_efb_ios_130', name: '130 Coins (iOS)', price: 150, basePrice: 120, description: 'iOS In-Game Coins' },
      { id: 'pkg_efb_ios_260', name: '260 Coins (iOS)', price: 295, basePrice: 235, description: 'iOS In-Game Coins' },
      { id: 'pkg_efb_ios_550', name: '550 Coins (iOS)', price: 600, basePrice: 480, description: 'iOS In-Game Coins' },
      { id: 'pkg_efb_ios_1050', name: '1050 Coins (iOS)', price: 1150, basePrice: 920, description: 'iOS In-Game Coins' },
      { id: 'pkg_efb_ios_2130', name: '2130 Coins (iOS)', price: 2250, basePrice: 1800, description: 'iOS In-Game Coins' }
    ]
  },
  {
    id: 'game_ff',
    code: 'ff',
    title: 'FREE FIRE — DIAMONDS',
    fullName: 'FREE FIRE — DIAMONDS TOP UP',
    emoji: '🔥',
    requiresUid: true,
    inputLabel: 'Free Fire Player UID',
    inputPrompt: '🔥 আপনার *Free Fire Player UID* টি লিখে পাঠান (যেমন: `123456789`):',
    packages: [
      { id: 'pkg_ff_115', name: '115 Diamonds', price: 95, basePrice: 76, description: 'Direct UID Top-Up' },
      { id: 'pkg_ff_240', name: '240 Diamonds', price: 190, basePrice: 152, description: 'Direct UID Top-Up' },
      { id: 'pkg_ff_355', name: '355 Diamonds', price: 280, basePrice: 225, description: 'Direct UID Top-Up' },
      { id: 'pkg_ff_610', name: '610 Diamonds', price: 470, basePrice: 375, description: 'Direct UID Top-Up' },
      { id: 'pkg_ff_1240', name: '1240 Diamonds', price: 930, basePrice: 745, description: 'Direct UID Top-Up' },
      { id: 'pkg_ff_weekly', name: 'Weekly Membership', price: 190, basePrice: 150, description: 'Weekly Pass' },
      { id: 'pkg_ff_monthly', name: 'Monthly Membership', price: 930, basePrice: 740, description: 'Monthly Pass' }
    ]
  },
  {
    id: 'game_movie',
    code: 'movie',
    title: 'MOVIE/ANIME — SUBS',
    fullName: 'MOVIE/ANIME — SUBSCRIPTION & PACKS',
    emoji: '🎬',
    requiresUid: false,
    inputLabel: 'Email / Gmail Account',
    inputPrompt: '🎬 আপনার *Email / Gmail অ্যাড্রেস* লিখে পাঠান (যেখানে সাবস্ক্রিপশন অ্যাকাউন্ট ও লগইন তথ্য পাঠানো হবে):',
    packages: [
      { id: 'pkg_sub_netflix', name: 'Netflix 1M (1 Screen)', price: 320, basePrice: 230, description: '1 Month UHD Screen' },
      { id: 'pkg_sub_crunchyroll', name: 'Crunchyroll 1M (Fan)', price: 180, basePrice: 125, description: '1 Month Anime Streaming' },
      { id: 'pkg_sub_prime_vid', name: 'Prime Video 1M', price: 150, basePrice: 105, description: '1 Month Private Profile' },
      { id: 'pkg_sub_spotify', name: 'Spotify 1M Premium', price: 120, basePrice: 85, description: '1 Month Individual' },
      { id: 'pkg_sub_youtube', name: 'YouTube 1M Premium', price: 150, basePrice: 105, description: '1 Month Family Invite' }
    ]
  }
];

export const PAYMENT_ACCOUNTS = {
  bkash: '01872239597',
  rocket: '01872239597',
  nagad: '01330719250'
};

export function findGameCategory(identifier?: string | null): GameCategory | undefined {
  if (!identifier) return undefined;
  const clean = identifier.toLowerCase().trim();
  if (!clean || clean.length < 2) return undefined;
  return GAME_CATEGORIES.find(
    g => g.id.toLowerCase() === clean || 
         g.code.toLowerCase() === clean || 
         g.fullName.toLowerCase() === clean || 
         g.title.toLowerCase() === clean ||
         g.fullName.toLowerCase().includes(clean)
  );
}

export function findPackage(game: GameCategory, identifier?: string | null): GamePackage | undefined {
  if (!identifier) return undefined;
  const clean = identifier.toLowerCase().trim();
  if (!clean || clean.length < 2) return undefined;
  return game.packages.find(
    p => p.id.toLowerCase() === clean || 
         p.name.toLowerCase() === clean || 
         (clean.startsWith('pkg_') && p.id.toLowerCase().includes(clean))
  );
}
