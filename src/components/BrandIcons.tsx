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

export function PubgIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="6" fill="url(#pubg_bg)" />
      <path
        d="M12 4.5C8.5 4.5 6 7 6 10.5C6 13 7.5 15 9.5 16.5L9 19.5L12 18.5L15 19.5L14.5 16.5C16.5 15 18 13 18 10.5C18 7 15.5 4.5 12 4.5Z"
        fill="#F59E0B"
      />
      <path
        d="M8.5 10.5H15.5V12.5C15.5 14 14 15 12 15C10 15 8.5 14 8.5 12.5V10.5Z"
        fill="#1E293B"
      />
      <rect x="9.5" y="11" width="5" height="1" rx="0.5" fill="#38BDF8" />
      <defs>
        <linearGradient id="pubg_bg" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E293B" />
          <stop offset="1" stopColor="#0F172A" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function FreeFireIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="6" fill="url(#ff_bg)" />
      <path
        d="M12 4C12 4 14.5 7.5 14.5 10C14.5 10.5 14.3 11 14 11.4C14.8 11.2 16.5 10.5 16.5 9C16.5 13 13.5 18 9.5 18C7 18 5 16 5 13.5C5 10.5 7.5 8 9.5 6.5C9.5 7.5 10 9 11 9.5C11 7.5 12 4 12 4Z"
        fill="#FBBF24"
      />
      <path
        d="M12 11C12 11 13.5 12.5 13.5 14C13.5 15.5 12 16.5 10.5 16.5C9.5 16.5 8.5 15.5 8.5 14C8.5 12.5 10 11.5 10.5 11C11 12 11.5 12.5 12 11Z"
        fill="#EF4444"
      />
      <defs>
        <linearGradient id="ff_bg" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EA580C" />
          <stop offset="1" stopColor="#991B1B" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function EfootballIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="6" fill="url(#efb_bg)" />
      <circle cx="12" cy="12" r="7.5" fill="#0284C7" stroke="#38BDF8" strokeWidth="1" />
      <path
        d="M12 7.5L14 9.5L13.2 12.5H10.8L10 9.5L12 7.5Z"
        fill="#F8FAFC"
      />
      <path d="M12 4.5V7.5M16.5 6L14 9.5M18.5 11.5L13.2 12.5M16.5 17L12.5 15.5M7.5 6L10 9.5M5.5 11.5L10.8 12.5M7.5 17L11.5 15.5" stroke="#F8FAFC" strokeWidth="0.8" />
      <defs>
        <linearGradient id="efb_bg" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0369A1" />
          <stop offset="1" stopColor="#0C4A6E" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function MovieSubIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="6" fill="url(#movie_bg)" />
      <rect x="5" y="6" width="14" height="12" rx="2" fill="#E11D48" />
      <path d="M10 9L15 12L10 15V9Z" fill="white" />
      <defs>
        <linearGradient id="movie_bg" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#BE123C" />
          <stop offset="1" stopColor="#881337" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function PubgKrIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="6" fill="#0F172A" stroke="#334155" strokeWidth="1" />
      <circle cx="12" cy="12" r="5" fill="#E2E8F0" />
      <path d="M12 7C9.24 7 7 9.24 7 12C7 13.5 8 14 9.5 14C11 14 12 13 12 12C12 11 13 10 14.5 10C16 10 17 10.5 17 12C17 9.24 14.76 7 12 7Z" fill="#DC2626" />
      <path d="M12 17C14.76 17 17 14.76 17 12C17 10.5 16 10 14.5 10C13 10 12 11 12 12C12 13 11 14 9.5 14C8 14 7 13.5 7 12C7 14.76 9.24 17 12 17Z" fill="#2563EB" />
    </svg>
  );
}

export function PubgQrIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="6" fill="#1E1B4B" stroke="#4338CA" strokeWidth="1" />
      <rect x="6" y="6" width="4" height="4" fill="#818CF8" />
      <rect x="14" y="6" width="4" height="4" fill="#818CF8" />
      <rect x="6" y="14" width="4" height="4" fill="#818CF8" />
      <rect x="14" y="14" width="2" height="2" fill="#818CF8" />
      <rect x="16" y="16" width="2" height="2" fill="#818CF8" />
      <rect x="11" y="11" width="2" height="2" fill="#818CF8" />
    </svg>
  );
}

export function CrownSubIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="6" fill="#78350F" />
      <path
        d="M6 16.5H18L17 10L14 12.5L12 7.5L10 12.5L7 10L6 16.5Z"
        fill="#FBBF24"
      />
      <circle cx="7" cy="9" r="1" fill="#FDE68A" />
      <circle cx="12" cy="6.5" r="1" fill="#FDE68A" />
      <circle cx="17" cy="9" r="1" fill="#FDE68A" />
    </svg>
  );
}

/**
 * Returns a high-fidelity SVG icon for any game category ID
 */
export function CategoryIcon({ categoryId, className = 'w-4 h-4' }: { categoryId?: string; className?: string }) {
  const id = (categoryId || '').toLowerCase();
  if (id.includes('ff') || id.includes('freefire')) return <FreeFireIcon className={className} />;
  if (id.includes('efb') || id.includes('efootball')) return <EfootballIcon className={className} />;
  if (id.includes('movie') || id.includes('anime') || id.includes('sub_netflix')) return <MovieSubIcon className={className} />;
  if (id.includes('kr')) return <PubgKrIcon className={className} />;
  if (id.includes('login') || id.includes('qr') || id.includes('special')) return <PubgQrIcon className={className} />;
  if (id.includes('sub') || id.includes('prime')) return <CrownSubIcon className={className} />;
  return <PubgIcon className={className} />;
}
