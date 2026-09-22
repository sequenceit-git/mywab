import React from 'react';

export function BrandLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-emerald-400 blur-[6px] opacity-70 animate-pulse"></div>
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative z-10 drop-shadow-md shrink-0"
      >
        <rect width="40" height="40" rx="10" fill="url(#logo_grad)" />
        <path
          d="M12 28L18 12H22L28 28H23.5L22.2 24H17.8L16.5 28H12ZM18.8 20.5H21.2L20 16.8L18.8 20.5Z"
          fill="white"
          fillRule="evenodd"
        />
        <circle cx="28" cy="12" r="3.5" fill="#10B981" stroke="#090D16" strokeWidth="1.5" />
        <defs>
          <linearGradient id="logo_grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6366F1" />
            <stop offset="0.5" stopColor="#3B82F6" />
            <stop offset="1" stopColor="#10B981" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export function WhatsAppIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 01-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 012.41 5.83c0 4.54-3.7 8.23-8.23 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.84-.86 2.05s.88 2.38 1 2.54c.12.17 1.73 2.64 4.2 3.7.59.25 1.05.4 1.41.51.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z" />
    </svg>
  );
}

export function TelegramIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
    </svg>
  );
}

export function BkashIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="6" fill="#E2136E" />
      <path
        d="M13.8 4.5L7.2 12.8L12.5 13.5L13.8 4.5Z"
        fill="white"
      />
      <path
        d="M13.8 4.5L19.2 10.2L12.5 13.5L13.8 4.5Z"
        fill="#FFE5EE"
      />
      <path
        d="M7.2 12.8L4.5 18.5L12.5 13.5L7.2 12.8Z"
        fill="#FF94BA"
      />
      <path
        d="M12.5 13.5L11.5 19.5L18.5 15.5L12.5 13.5Z"
        fill="white"
      />
    </svg>
  );
}

export function NagadIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="6" fill="url(#nagad_grad)" />
      <path
        d="M12 5.5C8.41 5.5 5.5 8.41 5.5 12C5.5 15.59 8.41 18.5 12 18.5C14.76 18.5 17.11 16.78 18 14.35C16.95 15.65 15.33 16.5 13.5 16.5C10.46 16.5 8 14.04 8 11C8 7.96 10.46 5.5 13.5 5.5C14.2 5.5 14.86 5.63 15.47 5.87C14.44 5.63 13.25 5.5 12 5.5Z"
        fill="white"
      />
      <circle cx="16" cy="9" r="2.2" fill="white" />
      <defs>
        <linearGradient id="nagad_grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F7941D" />
          <stop offset="1" stopColor="#ED1C24" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function RocketIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="6" fill="#8C3494" />
      <path
        d="M12 4.5C10.5 7 10 10 10 13L8 15V17L12 15.5L16 17V15L14 13C14 10 13.5 7 12 4.5Z"
        fill="white"
      />
      <circle cx="12" cy="9.5" r="1.5" fill="#8C3494" />
      <path d="M12 17V19.5" stroke="#FDB913" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function SupabaseIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 24 24" fill="none">
      <path
        d="M13.35 2.05a1 1 0 00-1.7.95l1.8 7.5H4a1 1 0 00-.8 1.6l9.5 10.5a1 1 0 001.7-.95l-1.8-7.5H20a1 1 0 00.8-1.6L13.35 2.05z"
        fill="#3ECF8E"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 1. PUBG Mobile UID Top Up Icon (Tactical Helmet & Gold Crest)
// ---------------------------------------------------------------------------
export function PubgUidIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="url(#pubg_uid_bg)" />
      {/* Helmet Shell */}
      <path
        d="M16 6C10.5 6 7 9.5 7 14.5C7 18 9 20.8 11.8 22.5L11 26H21L20.2 22.5C23 20.8 25 18 25 14.5C25 9.5 21.5 6 16 6Z"
        fill="url(#pubg_helmet_grad)"
      />
      {/* Visor Slit (Dark Grill) */}
      <path
        d="M10 14H22V17.5C22 19 20 20.5 16 20.5C12 20.5 10 19 10 17.5V14Z"
        fill="#090D16"
      />
      {/* Visor Glowing Amber Line */}
      <rect x="11.5" y="15" width="9" height="1.8" rx="0.9" fill="#F59E0B" />
      {/* Level 3 Metallic Rivet */}
      <circle cx="16" cy="9" r="1.2" fill="#E2E8F0" />
      <circle cx="10" cy="11" r="1" fill="#E2E8F0" />
      <circle cx="22" cy="11" r="1" fill="#E2E8F0" />
      <defs>
        <linearGradient id="pubg_uid_bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E293B" />
          <stop offset="1" stopColor="#0B0F19" />
        </linearGradient>
        <linearGradient id="pubg_helmet_grad" x1="7" y1="6" x2="25" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F59E0B" />
          <stop offset="0.6" stopColor="#D97706" />
          <stop offset="1" stopColor="#78350F" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 2. PUBG Mobile Login UC (QR Code Scanner Badge)
// ---------------------------------------------------------------------------
export function PubgLoginIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="url(#pubg_login_bg)" />
      {/* Smartphone frame */}
      <rect x="8" y="5" width="16" height="22" rx="3.5" fill="#0F172A" stroke="#6366F1" strokeWidth="1.5" />
      {/* Phone screen with QR matrix */}
      <rect x="10" y="8" width="12" height="14" rx="1.5" fill="#1E1B4B" />
      {/* QR Corner Markers */}
      <rect x="11.5" y="9.5" width="3" height="3" fill="#A5B4FC" />
      <rect x="17.5" y="9.5" width="3" height="3" fill="#A5B4FC" />
      <rect x="11.5" y="17.5" width="3" height="3" fill="#A5B4FC" />
      {/* QR Data Dots */}
      <rect x="15.5" y="11" width="1.2" height="1.2" fill="#818CF8" />
      <rect x="16.5" y="14" width="2" height="1.2" fill="#38BDF8" />
      <rect x="12" y="14" width="2.5" height="1.2" fill="#818CF8" />
      <rect x="16" y="17.5" width="2" height="2" fill="#A5B4FC" />
      {/* Scanner laser beam line */}
      <line x1="9.5" y1="15" x2="22.5" y2="15" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
      {/* Phone Home Bar */}
      <rect x="14" y="24" width="4" height="1" rx="0.5" fill="#6366F1" />
      <defs>
        <linearGradient id="pubg_login_bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#312E81" />
          <stop offset="1" stopColor="#0F172A" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 3. PUBG Mobile Subscription (Royal Gold & Gem Crown)
// ---------------------------------------------------------------------------
export function PubgSubIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="url(#pubg_sub_bg)" />
      {/* Crown Base */}
      <path
        d="M6.5 22.5H25.5L24 13.5L19.5 17L16 9.5L12.5 17L8 13.5L6.5 22.5Z"
        fill="url(#crown_gold_grad)"
        stroke="#F59E0B"
        strokeWidth="1"
      />
      {/* Crown Bottom Band */}
      <rect x="6.5" y="22.5" width="19" height="3" rx="1" fill="#D97706" />
      {/* Jewels */}
      <circle cx="8" cy="13" r="1.5" fill="#FEF08A" />
      <circle cx="16" cy="9" r="2" fill="#EF4444" stroke="#FDE68A" strokeWidth="0.8" />
      <circle cx="24" cy="13" r="1.5" fill="#FEF08A" />
      <circle cx="11.5" cy="24" r="1" fill="#38BDF8" />
      <circle cx="16" cy="24" r="1.2" fill="#FEF08A" />
      <circle cx="20.5" cy="24" r="1" fill="#38BDF8" />
      <defs>
        <linearGradient id="pubg_sub_bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#451A03" />
          <stop offset="1" stopColor="#1E0D03" />
        </linearGradient>
        <linearGradient id="crown_gold_grad" x1="6.5" y1="9.5" x2="25.5" y2="25.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE047" />
          <stop offset="0.5" stopColor="#F59E0B" />
          <stop offset="1" stopColor="#B45309" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 4. PUBG Mobile KR Korean UC (Taegeuk National Crest)
// ---------------------------------------------------------------------------
export function PubgKrIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="url(#pubg_kr_bg)" />
      {/* Crest Circle Base */}
      <circle cx="16" cy="16" r="10" fill="#0F172A" stroke="#475569" strokeWidth="1.2" />
      {/* Taegeuk Red Upper Swirl */}
      <path
        d="M16 9C12.13 9 9 12.13 9 16C9 17.5 9.5 18.5 11 18.5C13.5 18.5 14.5 16 16 16C17.5 16 19 17 21 17C22.5 17 23 16 23 16C23 12.13 19.87 9 16 9Z"
        fill="#EF4444"
      />
      {/* Taegeuk Blue Lower Swirl */}
      <path
        d="M16 23C19.87 23 23 19.87 23 16C23 16 22.5 17 21 17C19 17 17.5 16 16 16C14.5 16 13.5 18.5 11 18.5C9.5 18.5 9 17.5 9 16C9 19.87 12.13 23 16 23Z"
        fill="#2563EB"
      />
      {/* Gold KR text pill at bottom */}
      <rect x="11.5" y="21" width="9" height="4" rx="1.5" fill="#D97706" />
      <text x="16" y="24" textAnchor="middle" fontSize="3.2" fontWeight="900" fill="#FFFFFF" fontFamily="sans-serif">KR</text>
      <defs>
        <linearGradient id="pubg_kr_bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E293B" />
          <stop offset="1" stopColor="#090D16" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 5. eFootball Android Coins (Electric Blue Soccer Crest & Android Gold)
// ---------------------------------------------------------------------------
export function EfootballAndroidIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="url(#efb_and_bg)" />
      {/* Soccer Ball Hexagon Base */}
      <circle cx="16" cy="15" r="9" fill="#0284C7" stroke="#38BDF8" strokeWidth="1.5" />
      <polygon points="16,9.5 20,12.5 18.5,17 13.5,17 12,12.5" fill="#FFFFFF" />
      <line x1="16" y1="6" x2="16" y2="9.5" stroke="#FFFFFF" strokeWidth="1" />
      <line x1="22.5" y1="10" x2="20" y2="12.5" stroke="#FFFFFF" strokeWidth="1" />
      <line x1="21.5" y1="20" x2="18.5" y2="17" stroke="#FFFFFF" strokeWidth="1" />
      <line x1="10.5" y1="20" x2="13.5" y2="17" stroke="#FFFFFF" strokeWidth="1" />
      <line x1="9.5" y1="10" x2="12" y2="12.5" stroke="#FFFFFF" strokeWidth="1" />
      {/* Android Badge */}
      <rect x="8.5" y="22" width="15" height="4.5" rx="2" fill="#10B981" />
      <text x="16" y="25.5" textAnchor="middle" fontSize="3" fontWeight="900" fill="#FFFFFF" fontFamily="sans-serif">ANDROID</text>
      <defs>
        <linearGradient id="efb_and_bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0369A1" />
          <stop offset="1" stopColor="#082F49" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 6. eFootball iOS Coins (Apple Crest & eFootball Gold Coin)
// ---------------------------------------------------------------------------
export function EfootballIosIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="url(#efb_ios_bg)" />
      {/* Gold Coin / Apple Silhouette */}
      <circle cx="16" cy="14" r="8.5" fill="url(#ios_coin_grad)" stroke="#FDE047" strokeWidth="1.2" />
      {/* Apple Leaf & Silhouette in center */}
      <path
        d="M16 10C16 10 16.5 8.5 17.5 8.5C18.5 8.5 18 10 18 10C18 10 17.5 10 16 10Z"
        fill="#0284C7"
      />
      <path
        d="M16 10.5C14.5 10.5 13.5 11.2 12.8 12.2C11.8 13.5 12 16 13 17.5C13.5 18.2 14.2 19 15 19C15.8 19 16.2 18.5 17 18.5C17.8 18.5 18.2 19 19 19C19.8 19 20.5 18.2 21 17.5C20.2 17 19.8 16 19.8 15C19.8 13.5 21 12.5 21.2 12.2C20.5 11.2 19.2 10.5 18 10.5C17.2 10.5 16.5 11 16 10.5Z"
        fill="#0284C7"
      />
      {/* iOS Badge */}
      <rect x="10" y="22" width="12" height="4.5" rx="2" fill="#0284C7" />
      <text x="16" y="25.5" textAnchor="middle" fontSize="3.2" fontWeight="900" fill="#FFFFFF" fontFamily="sans-serif">iOS</text>
      <defs>
        <linearGradient id="efb_ios_bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E293B" />
          <stop offset="1" stopColor="#0B132B" />
        </linearGradient>
        <linearGradient id="ios_coin_grad" x1="7.5" y1="5.5" x2="24.5" y2="22.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FEF08A" />
          <stop offset="0.6" stopColor="#F59E0B" />
          <stop offset="1" stopColor="#B45309" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 7. Free Fire Diamonds (Garena Flame & Radiant Diamond Crystal)
// ---------------------------------------------------------------------------
export function FreeFireIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="url(#ff_bg_grad)" />
      {/* Fiery Wing / Outer Flame */}
      <path
        d="M16 5C16 5 19.5 9.5 19.5 13C19.5 14 19 14.8 18.5 15.2C19.8 15 22.5 14 22.5 12C22.5 17.5 18 24 13 24C9.5 24 6.5 21.5 6.5 17.5C6.5 13.5 10 10 12.5 8C12.5 9.5 13.2 11.5 14.5 12.2C14.5 9.5 16 5 16 5Z"
        fill="url(#ff_flame_grad)"
      />
      {/* Radiant Cyan Diamond In Front */}
      <polygon points="21,14 26,14 28,17 23.5,23 19,17" fill="#38BDF8" stroke="#E0F2FE" strokeWidth="0.8" />
      <polygon points="21,14 26,14 23.5,17" fill="#BAE6FD" />
      <polygon points="21,14 23.5,17 19,17" fill="#0284C7" />
      <polygon points="26,14 28,17 23.5,17" fill="#0284C7" />
      <polygon points="23.5,17 28,17 23.5,23" fill="#0369A1" />
      <polygon points="19,17 23.5,17 23.5,23" fill="#0284C7" />
      <defs>
        <linearGradient id="ff_bg_grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C2D12" />
          <stop offset="1" stopColor="#2A0800" />
        </linearGradient>
        <linearGradient id="ff_flame_grad" x1="6.5" y1="5" x2="22.5" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE047" />
          <stop offset="0.4" stopColor="#F97316" />
          <stop offset="1" stopColor="#DC2626" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 8. Movie & Anime Subscriptions (Cinema Clapperboard & Play Crystal)
// ---------------------------------------------------------------------------
export function MovieSubIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="url(#movie_sub_bg)" />
      {/* Cinema Clapper Board Body */}
      <rect x="6" y="11" width="20" height="15" rx="3" fill="#18181B" stroke="#E11D48" strokeWidth="1.2" />
      {/* Clapper Top Striped Bar */}
      <rect x="6" y="6" width="20" height="5" rx="1.5" fill="#E11D48" />
      <polygon points="9,6 11,6 8,11 6,11" fill="#FFFFFF" />
      <polygon points="14,6 16,6 13,11 11,11" fill="#FFFFFF" />
      <polygon points="19,6 21,6 18,11 16,11" fill="#FFFFFF" />
      <polygon points="24,6 26,6 23,11 21,11" fill="#FFFFFF" />
      {/* Streaming Play Button */}
      <circle cx="16" cy="18.5" r="4.5" fill="#E11D48" />
      <polygon points="14.5,16.5 18.5,18.5 14.5,20.5" fill="#FFFFFF" />
      <defs>
        <linearGradient id="movie_sub_bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#881337" />
          <stop offset="1" stopColor="#1E050D" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Alias helper
export const PubgIcon = PubgUidIcon;
export const EfootballIcon = EfootballAndroidIcon;
export const CrownSubIcon = PubgSubIcon;

/**
 * Returns a high-fidelity SVG icon for any game category ID
 */
export function CategoryIcon({ categoryId, className = 'w-6 h-6' }: { categoryId?: string; className?: string }) {
  const id = (categoryId || '').toLowerCase();
  if (id.includes('ff') || id.includes('freefire')) return <FreeFireIcon className={className} />;
  if (id.includes('efb_ios') || id.includes('ios')) return <EfootballIosIcon className={className} />;
  if (id.includes('efb') || id.includes('efootball') || id.includes('android')) return <EfootballAndroidIcon className={className} />;
  if (id.includes('movie') || id.includes('anime') || id.includes('sub_netflix') || id.includes('streaming')) return <MovieSubIcon className={className} />;
  if (id.includes('kr') || id.includes('korean')) return <PubgKrIcon className={className} />;
  if (id.includes('login') || id.includes('qr') || id.includes('special')) return <PubgLoginIcon className={className} />;
  if (id.includes('sub') || id.includes('prime')) return <PubgSubIcon className={className} />;
  return <PubgUidIcon className={className} />;
}

