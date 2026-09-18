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
