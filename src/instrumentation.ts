export async function register() {
  process.env['WS_NO_BUFFER_UTIL'] = '1';
  process.env['WS_NO_UTF_8_VALIDATE'] = '1';

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { env } = await import('@/lib/config/env');
    if (env.whatsapp.provider === 'baileys') {
      const { baileysManager } = await import('@/lib/baileys');
      console.log('[Instrumentation] Auto-initializing Baileys WhatsApp Web client...');
      baileysManager.init().catch(err => {
        console.error('[Instrumentation] Failed to auto-initialize Baileys:', err);
      });
    }
  }
}
