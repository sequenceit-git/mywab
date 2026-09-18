import React from 'react';

export function BrandLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-emerald-400 blur-[6px] opacity-70 animate-pulse"></div>
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative z-10 drop-shadow-md"
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
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.072-2.193-.55-1.503-.623-2.483-2.138-2.558-2.238-.075-.1-.611-.813-.611-1.55 0-.737.387-1.1.524-1.25.137-.15.299-.187.399-.187.1 0 .199.001.287.006.091.005.213-.035.333.253.125.3.424 1.036.462 1.112.038.075.063.163.013.263-.05.1-.075.163-.15.25-.075.088-.158.196-.226.263-.075.075-.153.156-.066.306.087.15.388.64 832 1.036.572.509 1.054.667 1.204.742.15.075.237.063.325-.038.087-.1.375-.437.474-.587.1-.15.199-.125.337-.075.137.05.874.412 1.024.487.15.075.249.112.287.175.037.062.037.362-.107.767z" />
    </svg>
  );
}

export function TelegramIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
    </svg>
  );
}

export function BkashIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center font-bold font-sans text-[10px] rounded px-1.5 py-0.5 bg-[#E2136E] text-white ${className}`}>
      bKash
    </span>
  );
}

export function NagadIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center font-bold font-sans text-[10px] rounded px-1.5 py-0.5 bg-[#F7941D] text-white ${className}`}>
      Nagad
    </span>
  );
}

export function RocketIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center font-bold font-sans text-[10px] rounded px-1.5 py-0.5 bg-[#8C3494] text-white ${className}`}>
      Rocket
    </span>
  );
}

export function SupabaseIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M13.35 2.05a1 1 0 00-1.7.95l1.8 7.5H4a1 1 0 00-.8 1.6l9.5 10.5a1 1 0 001.7-.95l-1.8-7.5H20a1 1 0 00.8-1.6L13.35 2.05z"
        fill="#3ECF8E"
      />
    </svg>
  );
}
