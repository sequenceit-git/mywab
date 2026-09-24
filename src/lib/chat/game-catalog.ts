export interface GamePackage {
  id: string;          // Button/selection ID e.g. 'pkg_pubg_60'
  name: string;        // e.g. '60 UC'
  amount?: string;     // e.g. '60' or '60 UC' or '1 Month'
  price: number;       // Selling price e.g. 115
  basePrice?: number;  // Cost / Wholesale Base Price for profit calculation e.g. 95
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
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
      { id: 'pkg_pubg_60', name: '60 UC', amount: '60', price: 115, basePrice: 95, description: 'Direct In-Game Top-Up' },
      { id: 'pkg_pubg_120', name: '120 UC', amount: '120', price: 230, basePrice: 190, description: 'Direct In-Game Top-Up' },
      { id: 'pkg_pubg_180', name: '180 UC', amount: '180', price: 340, basePrice: 285, description: 'Direct In-Game Top-Up' },
      { id: 'pkg_pubg_325', name: '325 UC', amount: '325', price: 600, basePrice: 495, description: 'Direct In-Game Top-Up' },
      { id: 'pkg_pubg_385', name: '385 UC [50 RP]', amount: '385', price: 710, basePrice: 590, description: 'Royale Pass 50 RP Pack' },
      { id: 'pkg_pubg_660', name: '660 UC', amount: '660', price: 1150, basePrice: 960, description: 'Direct In-Game Top-Up' },
      { id: 'pkg_pubg_720', name: '720 UC [100 RP]', amount: '720', price: 1250, basePrice: 1040, description: 'Royale Pass 100 RP Pack' },
      { id: 'pkg_pubg_1045', name: '1045 UC', amount: '1045', price: 1850, basePrice: 1550, description: 'Direct In-Game Top-Up' },
      { id: 'pkg_pubg_1800', name: '1800 UC', amount: '1800', price: 3150, basePrice: 2620, description: 'Mega Pack Top-Up' },
      { id: 'pkg_pubg_3850', name: '3850 UC', amount: '3850', price: 6500, basePrice: 5400, description: 'Super Mega Pack' }
    ]
  },
  {
    id: 'game_pubg_login',
    code: 'pubg_login',
    title: 'PUBG — LOGIN UC (QR)',
    fullName: 'PUBG MOBILE — LOGIN UC ( QR )',
    emoji: '📲',
    requiresUid: false,
    inputLabel: 'Game UID / In-Game Name',
    inputPrompt: '📲 আপনার *Game UID / Game ID* এবং *In-Game Name* লিখে পাঠান (টপ-আপের সময় আমাদের এজেন্ট QR কোড দিয়ে লগইন করে দেবেন):',
    packages: [
      { id: 'pkg_login_325', name: '300+25 UC (QR)', amount: '325', price: 520, basePrice: 420, description: 'QR Code Login Top-Up' },
      { id: 'pkg_login_660', name: '600+60 UC (QR)', amount: '660', price: 1000, basePrice: 820, description: 'QR Code Login Top-Up' },
      { id: 'pkg_login_1800', name: '1500+300 UC (QR)', amount: '1800', price: 2450, basePrice: 2000, description: 'QR Code Login Top-Up' },
      { id: 'pkg_login_3850', name: '3000+850 UC (QR)', amount: '3850', price: 4850, basePrice: 3950, description: 'QR Code Login Top-Up' },
      { id: 'pkg_login_8100', name: '6000+2100 UC (QR)', amount: '8100', price: 9400, basePrice: 7700, description: 'QR Code Login Top-Up' },
      { id: 'pkg_spec_1', name: 'Special Pack 1 (QR)', amount: 'Special 1', price: 450, basePrice: 360, description: 'Special Login QR UC' },
      { id: 'pkg_spec_2', name: 'Special Pack 2 (QR)', amount: 'Special 2', price: 890, basePrice: 710, description: 'Special Login QR UC' },
      { id: 'pkg_spec_3', name: 'Special Pack 3 (QR)', amount: 'Special 3', price: 1750, basePrice: 1400, description: 'Special Login QR UC' }
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
      { id: 'pkg_sub_prime', name: 'Prime (1 Month)', amount: 'Prime', price: 150, basePrice: 110, description: 'Instant UID Activation' },
      { id: 'pkg_sub_prime_plus', name: 'Prime Plus (1 Month)', amount: 'Prime Plus', price: 1150, basePrice: 930, description: 'Instant UID Activation' }
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
      { id: 'pkg_kr_60', name: '60 KR UC', amount: '60', price: 130, basePrice: 105, description: 'PUBG KR UID Top-Up' },
      { id: 'pkg_kr_180', name: '180 KR UC', amount: '180', price: 390, basePrice: 315, description: 'PUBG KR UID Top-Up' },
      { id: 'pkg_kr_360', name: '360 KR UC', amount: '360', price: 750, basePrice: 610, description: 'PUBG KR UID Top-Up' },
      { id: 'pkg_kr_660', name: '660 KR UC', amount: '660', price: 1350, basePrice: 1100, description: 'PUBG KR UID Top-Up' },
      { id: 'pkg_kr_1200', name: '1200 KR UC', amount: '1200', price: 2400, basePrice: 1950, description: 'PUBG KR UID Top-Up' }
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
      { id: 'pkg_efb_and_130', name: '130 Coins (Android)', amount: '130', price: 140, basePrice: 110, description: 'Android In-Game Coins' },
      { id: 'pkg_efb_and_260', name: '260 Coins (Android)', amount: '260', price: 280, basePrice: 225, description: 'Android In-Game Coins' },
      { id: 'pkg_efb_and_550', name: '550 Coins (Android)', amount: '550', price: 580, basePrice: 465, description: 'Android In-Game Coins' },
      { id: 'pkg_efb_and_1050', name: '1050 Coins (Android)', amount: '1050', price: 1090, basePrice: 880, description: 'Android In-Game Coins' },
      { id: 'pkg_efb_and_2130', name: '2130 Coins (Android)', amount: '2130', price: 2150, basePrice: 1730, description: 'Android In-Game Coins' }
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
      { id: 'pkg_efb_ios_130', name: '130 Coins (iOS)', amount: '130', price: 150, basePrice: 120, description: 'iOS In-Game Coins' },
      { id: 'pkg_efb_ios_260', name: '260 Coins (iOS)', amount: '260', price: 295, basePrice: 235, description: 'iOS In-Game Coins' },
      { id: 'pkg_efb_ios_550', name: '550 Coins (iOS)', amount: '550', price: 600, basePrice: 480, description: 'iOS In-Game Coins' },
      { id: 'pkg_efb_ios_1050', name: '1050 Coins (iOS)', amount: '1050', price: 1150, basePrice: 920, description: 'iOS In-Game Coins' },
      { id: 'pkg_efb_ios_2130', name: '2130 Coins (iOS)', amount: '2130', price: 2250, basePrice: 1800, description: 'iOS In-Game Coins' }
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
      { id: 'pkg_ff_115', name: '115 Diamonds', amount: '115', price: 95, basePrice: 76, description: 'Direct UID Top-Up' },
      { id: 'pkg_ff_240', name: '240 Diamonds', amount: '240', price: 190, basePrice: 152, description: 'Direct UID Top-Up' },
      { id: 'pkg_ff_355', name: '355 Diamonds', amount: '355', price: 280, basePrice: 225, description: 'Direct UID Top-Up' },
      { id: 'pkg_ff_610', name: '610 Diamonds', amount: '610', price: 470, basePrice: 375, description: 'Direct UID Top-Up' },
      { id: 'pkg_ff_1240', name: '1240 Diamonds', amount: '1240', price: 930, basePrice: 745, description: 'Direct UID Top-Up' },
      { id: 'pkg_ff_weekly', name: 'Weekly Membership', amount: 'Weekly', price: 190, basePrice: 150, description: 'Weekly Pass' },
      { id: 'pkg_ff_monthly', name: 'Monthly Membership', amount: 'Monthly', price: 930, basePrice: 740, description: 'Monthly Pass' }
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
      { id: 'pkg_sub_netflix', name: 'Netflix 1M (1 Screen)', amount: 'Netflix 1M', price: 320, basePrice: 230, description: '1 Month UHD Screen' },
      { id: 'pkg_sub_crunchyroll', name: 'Crunchyroll 1M (Fan)', amount: 'Crunchyroll 1M', price: 180, basePrice: 125, description: '1 Month Anime Streaming' },
      { id: 'pkg_sub_prime_vid', name: 'Prime Video 1M', amount: 'Prime 1M', price: 150, basePrice: 105, description: '1 Month Private Profile' },
      { id: 'pkg_sub_spotify', name: 'Spotify 1M Premium', amount: 'Spotify 1M', price: 120, basePrice: 85, description: '1 Month Individual' },
      { id: 'pkg_sub_youtube', name: 'YouTube 1M Premium', amount: 'YouTube 1M', price: 150, basePrice: 105, description: '1 Month Family Invite' }
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
  const raw = identifier.toLowerCase().trim();
  const clean = raw.replace(/[^\w\s\u0980-\u09FF]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean || clean.length < 2) return undefined;

  // 1. Direct code/ID exact match
  const direct = GAME_CATEGORIES.find(
    g => g.id.toLowerCase() === raw || 
         g.code.toLowerCase() === raw || 
         g.fullName.toLowerCase() === raw || 
         g.title.toLowerCase() === raw
  );
  if (direct) return direct;

  // 2. Keyword matching for specific services
  if (clean.includes('netflix') || clean.includes('নেটফ্লিক্স') || 
      clean.includes('crunchyroll') || clean.includes('ক্রাঞ্চিরোল') ||
      clean.includes('spotify') || clean.includes('স্পটিফাই') ||
      clean.includes('anime') || clean.includes('movie') || clean.includes('মুভি') ||
      clean.includes('streaming') || clean.includes('subscription') || clean.includes('সাবস্ক্রিপশন') ||
      clean.includes('prime video') || clean.includes('youtube premium')) {
    return GAME_CATEGORIES.find(g => g.id === 'game_movie');
  }

  if (clean.includes('kr') || clean.includes('korean') || clean.includes('কোরিয়ান') || clean.includes('কোরিয়ান')) {
    return GAME_CATEGORIES.find(g => g.id === 'game_pubg_kr');
  }

  if (clean.includes('special') || clean.includes('স্পেশাল')) {
    return GAME_CATEGORIES.find(g => g.id === 'game_pubg_special');
  }

  if (clean.includes('login') || clean.includes('লগইন') || clean.includes('qr') || clean.includes('কিউআর')) {
    return GAME_CATEGORIES.find(g => g.id === 'game_pubg_login');
  }

  if (clean.includes('free fire') || clean.includes('freefire') || clean.includes('ff') || 
      clean.includes('ফ্রি ফায়ার') || clean.includes('ফ্রি ফায়ার') || clean.includes('ডায়মন্ড') || clean.includes('ডায়মন্ড')) {
    return GAME_CATEGORIES.find(g => g.id === 'game_ff');
  }

  if (clean.includes('ios') || clean.includes('apple') || clean.includes('আইওএস') || clean.includes('অ্যাপল')) {
    if (clean.includes('efootball') || clean.includes('efb') || clean.includes('coin') || clean.includes('কয়েন') || clean.includes('কয়েন')) {
      return GAME_CATEGORIES.find(g => g.id === 'game_efb_ios');
    }
  }

  if (clean.includes('efootball') || clean.includes('efb') || clean.includes('pes') || 
      clean.includes('ইফুটবল') || clean.includes('কয়েন') || clean.includes('কয়েন') || clean.includes('football')) {
    return GAME_CATEGORIES.find(g => g.id === 'game_efb_android');
  }

  if (clean.includes('pubg') || clean.includes('পাবজি') || clean.includes('uc') || clean.includes('ইউসি')) {
    return GAME_CATEGORIES.find(g => g.id === 'game_pubg_uid');
  }

  // 3. Fallback partial title match
  return GAME_CATEGORIES.find(
    g => g.fullName.toLowerCase().includes(clean) || 
         clean.includes(g.title.toLowerCase())
  );
}

/**
 * Convert Bengali digits (০-৯) to English digits (0-9)
 */
function toEnDigits(str: string): string {
  const map: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };
  return str.replace(/[০-৯]/g, d => map[d] || d);
}

export function findPackage(game: GameCategory, identifier?: string | null): GamePackage | undefined {
  if (!identifier) return undefined;
  const raw = identifier.toLowerCase().trim();
  const normalized = toEnDigits(raw);
  const clean = normalized.replace(/[^\w\s\u0980-\u09FF\[\]\(\)\+\-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return undefined;

  // 1. Direct ID match
  const directId = game.packages.find(p => p.id.toLowerCase() === raw || (raw.startsWith('pkg_') && p.id.toLowerCase().includes(raw)));
  if (directId) return directId;

  // 2. Direct Name exact match (case insensitive)
  const exactName = game.packages.find(p => p.name.toLowerCase() === normalized || p.name.toLowerCase() === clean);
  if (exactName) return exactName;

  // 2b. Direct Amount match (e.g. typing "60" or "115" or "1 Month")
  const exactAmount = game.packages.find(p => p.amount && (p.amount.toLowerCase() === normalized || p.amount.toLowerCase() === clean));
  if (exactAmount) return exactAmount;

  // 3. Game-specific intelligent intent mapping:

  // A. Movie / Streaming subscriptions
  if (game.id === 'game_movie') {
    if (clean.includes('netflix') || clean.includes('নেটফ্লিক্স')) {
      return game.packages.find(p => p.id === 'pkg_sub_netflix');
    }
    if (clean.includes('crunchyroll') || clean.includes('ক্রাঞ্চিরোল') || clean.includes('crunchy')) {
      return game.packages.find(p => p.id === 'pkg_sub_crunchyroll');
    }
    if (clean.includes('prime') || clean.includes('amazon') || clean.includes('প্রাইম')) {
      return game.packages.find(p => p.id === 'pkg_sub_prime_vid');
    }
    if (clean.includes('spotify') || clean.includes('স্পটিফাই')) {
      return game.packages.find(p => p.id === 'pkg_sub_spotify');
    }
    if (clean.includes('youtube') || clean.includes('yt') || clean.includes('ইউটিউব')) {
      return game.packages.find(p => p.id === 'pkg_sub_youtube');
    }
  }

  // B. PUBG Subscriptions
  if (game.id === 'game_pubg_sub') {
    if (clean.includes('plus') || clean.includes('প্লাস')) {
      return game.packages.find(p => p.id === 'pkg_sub_prime_plus');
    }
    if (clean.includes('prime') || clean.includes('প্রাইম')) {
      return game.packages.find(p => p.id === 'pkg_sub_prime');
    }
  }

  // C. Free Fire Memberships
  if (game.id === 'game_ff') {
    if (clean.includes('weekly') || clean.includes('উইকলি') || clean.includes('সাপ্তাহিক')) {
      return game.packages.find(p => p.id === 'pkg_ff_weekly');
    }
    if (clean.includes('monthly') || clean.includes('মান্থলি') || clean.includes('মাসিক')) {
      return game.packages.find(p => p.id === 'pkg_ff_monthly');
    }
  }

  // D. Number matching across packages (e.g. "60", "385", "115", "130")
  const numbersFound = normalized.match(/\b\d+\b/g);
  if (numbersFound && numbersFound.length > 0) {
    for (const numStr of numbersFound) {
      const num = parseInt(numStr, 10);
      // Match against package amount or name containing this number (e.g. '60 UC', '385 UC [50 RP]')
      const matchedByNum = game.packages.find(p => {
        if (p.amount) {
          const amtNum = p.amount.match(/\b\d+\b/);
          if (amtNum && parseInt(amtNum[0], 10) === num) return true;
        }
        const pNumbers = p.name.match(/\b\d+\b/g);
        return pNumbers && pNumbers.some(pn => parseInt(pn, 10) === num);
      });
      if (matchedByNum) return matchedByNum;
    }
  }

  // E. RP matching for PUBG (e.g. "50 rp", "100 rp", "rp")
  if (clean.includes('50 rp') || clean.includes('50rp')) {
    const p50 = game.packages.find(p => p.name.includes('50 RP'));
    if (p50) return p50;
  }
  if (clean.includes('100 rp') || clean.includes('100rp')) {
    const p100 = game.packages.find(p => p.name.includes('100 RP'));
    if (p100) return p100;
  }

  // F. Fuzzy substring matching
  return game.packages.find(p => {
    const pNameLow = p.name.toLowerCase();
    return clean.includes(pNameLow) || pNameLow.includes(clean);
  });
}

/**
 * Format a package into a WhatsApp Interactive List row (Meta 24-char title limit, 72-char desc limit)
 * Guarantees that the price is NEVER truncated and always 100% visible!
 */
export function formatWhatsAppRow(pkg: GamePackage): { id: string; title: string; description: string } {
  const priceTag = ` • ৳${pkg.price}`; // e.g. " • ৳320" (7-8 chars)
  const maxNameLen = Math.max(8, 24 - priceTag.length); // 16-17 chars

  let name = pkg.name;
  if (name.length > maxNameLen) {
    // 1. Strip parenthetical information e.g. "Netflix 1M (1 Screen)" -> "Netflix 1M"
    const cleaned = name.replace(/\s*\([^)]*\)/g, '').trim();
    if (cleaned.length <= maxNameLen) {
      name = cleaned;
    } else {
      // 2. Remove words like "Premium", "Membership", "Diamonds", "Coins"
      const simplified = cleaned.replace(/\s*(?:Premium|Membership|Diamonds|Coins|Pass)\b/gi, '').trim();
      if (simplified.length <= maxNameLen) {
        name = simplified;
      } else {
        name = name.slice(0, maxNameLen - 2) + '..';
      }
    }
  }

  const title = `${name}${priceTag}`;
  const description = `${pkg.name} | ৳${pkg.price} Tk (${pkg.description || 'Instant Top-Up'})`.slice(0, 72);

  return {
    id: pkg.id,
    title: title.slice(0, 24),
    description
  };
}

/**
 * Format a package into a WhatsApp Quick Reply Button (Meta 20-char button title limit)
 * Guarantees price is NEVER truncated!
 */
export function formatWhatsAppButton(pkg: GamePackage): { id: string; title: string } {
  const priceTag = ` ৳${pkg.price}`; // e.g. " ৳1150" (6 chars)
  const maxNameLen = Math.max(6, 20 - priceTag.length); // 14 chars

  let name = pkg.name;
  if (name.length > maxNameLen) {
    const cleaned = name.replace(/\s*\([^)]*\)/g, '').trim();
    if (cleaned.length <= maxNameLen) {
      name = cleaned;
    } else {
      name = name.slice(0, maxNameLen - 2) + '..';
    }
  }

  return {
    id: pkg.id,
    title: `${name}${priceTag}`.slice(0, 20)
  };
}

