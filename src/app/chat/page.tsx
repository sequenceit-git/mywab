'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ChatRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/orders');
  }, [router]);

  return (
    <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400 text-xs">
      WhatsApp AI operates autonomously in the backend. Redirecting to Live Orders...
    </div>
  );
}
