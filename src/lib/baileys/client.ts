process.env['WS_NO_BUFFER_UTIL'] = '1';
process.env['WS_NO_UTF_8_VALIDATE'] = '1';

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
  generateWAMessageFromContent,
  WASendableProduct,
  AnyMessageContent
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';

export type BaileysConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'PAIRING_CODE_READY' | 'CONNECTED';

export interface BaileysButton {
  id: string;
  title: string;
  type?: 'quick_reply' | 'url' | 'copy';
  value?: string; // URL for cta_url or code for cta_copy
}

export interface BaileysListRow {
  id: string;
  title: string;
  description?: string;
}

export interface BaileysListSection {
  title?: string;
  rows: BaileysListRow[];
}

export class BaileysManager {
  private sock: WASocket | null = null;
  private status: BaileysConnectionStatus = 'DISCONNECTED';
  private currentQr: string | null = null;
  private currentQrDataUrl: string | null = null;
  private currentPairingCode: string | null = null;
  private registeredPhone: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isInitializing = false;
  private messageHandler: ((message: proto.IWebMessageInfo) => Promise<void>) | null = null;

  constructor() {
    this.ensureAuthDir();
  }

  private get authPath(): string {
    const rawPath = env.whatsapp.authDir || './baileys_auth';
    return path.isAbsolute(rawPath) ? rawPath : path.join(process.cwd(), rawPath);
  }

  private ensureAuthDir(): void {
    try {
      if (!fs.existsSync(this.authPath)) {
        fs.mkdirSync(this.authPath, { recursive: true });
      }
    } catch (err) {
      console.error('[Baileys] Error creating auth directory:', err);
    }
  }

  public setMessageHandler(handler: (message: proto.IWebMessageInfo) => Promise<void>) {
    this.messageHandler = handler;
  }

  public formatJid(phone: string): string {
    const clean = phone.replace(/\D/g, '');
    return `${clean}@s.whatsapp.net`;
  }

  public get isConnected(): boolean {
    return this.status === 'CONNECTED';
  }

  public getStatus() {
    return {
      status: this.status,
      isConnected: this.isConnected,
      qrCode: this.currentQr,
      qrDataUrl: this.currentQrDataUrl,
      pairingCode: this.currentPairingCode,
      registeredPhone: this.registeredPhone,
      authDir: this.authPath
    };
  }

  /**
   * Start Baileys socket connection
   */
  public async init(): Promise<void> {
    if (this.isInitializing || this.sock) return;
    this.isInitializing = true;
    this.status = 'CONNECTING';

    try {
      this.ensureAuthDir();
      const { state, saveCreds } = await useMultiFileAuthState(this.authPath);

      const logger = pino({ level: 'error' });

      this.sock = makeWASocket({
        auth: state,
        logger,
        printQRInTerminal: false,
        browser: ['DS Dukan Bot', 'Chrome', '124.0.0'],
        syncFullHistory: false,
        generateHighQualityLinkPreview: true,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        markOnlineOnConnect: true,
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.currentQr = qr;
          try {
            this.currentQrDataUrl = await QRCode.toDataURL(qr);
          } catch (qrErr) {
            console.error('[Baileys] QR DataURL generation error:', qrErr);
          }
          this.status = 'QR_READY';
          console.log('[Baileys] New QR Code generated. Scan from WhatsApp or Admin panel.');
        }

        if (connection === 'open') {
          this.status = 'CONNECTED';
          this.currentQr = null;
          this.currentQrDataUrl = null;
          this.currentPairingCode = null;
          this.reconnectAttempts = 0;
          this.registeredPhone = this.sock?.user?.id ? this.sock.user.id.split(':')[0] : null;
          console.log(`[Baileys] ✅ Connection open! Connected as: ${this.registeredPhone}`);
        } else if (connection === 'close') {
          this.status = 'DISCONNECTED';
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.warn(`[Baileys] 🔌 Connection closed. Reason code: ${statusCode}. Reconnecting: ${shouldReconnect}`);

          if (statusCode === DisconnectReason.loggedOut) {
            console.warn('[Baileys] Device was logged out. Clearing auth credentials...');
            this.clearAuthFiles();
            this.sock = null;
            this.status = 'DISCONNECTED';
          } else if (shouldReconnect) {
            this.scheduleReconnect();
          }
        }
      });

      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const msg of messages) {
          if (msg.key?.fromMe) continue;
          if (this.messageHandler) {
            try {
              await this.messageHandler(msg);
            } catch (handlerErr) {
              console.error('[Baileys Message Handler Exception]:', handlerErr);
            }
          }
        }
      });

    } catch (err) {
      console.error('[Baileys] Initialization error:', err);
      this.status = 'DISCONNECTED';
      this.scheduleReconnect();
    } finally {
      this.isInitializing = false;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 30000);
    console.log(`[Baileys] Scheduling reconnect in ${Math.round(delay / 1000)}s (Attempt #${this.reconnectAttempts})...`);
    this.reconnectTimer = setTimeout(async () => {
      this.sock = null;
      await this.init();
    }, delay);
  }

  /**
   * Request an 8-digit Pairing Code for headless phone linking
   */
  public async requestPairingCode(phone: string): Promise<{ success: boolean; code?: string; error?: string }> {
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      return { success: false, error: 'Invalid phone number format' };
    }

    if (!this.sock || this.status === 'DISCONNECTED') {
      await this.init();
    }

    // Wait for the socket connection to be ready (up to 6 seconds)
    let waitCount = 0;
    while ((!this.sock || this.status === 'CONNECTING') && waitCount < 12) {
      await new Promise(r => setTimeout(r, 500));
      waitCount++;
    }

    try {
      if (!this.sock) {
        return { success: false, error: 'Socket initialization failed' };
      }

      const code = await this.sock.requestPairingCode(cleanPhone);
      this.currentPairingCode = code;
      this.status = 'PAIRING_CODE_READY';
      console.log(`[Baileys] 📲 Generated Pairing Code: ${code} for phone: ${cleanPhone}`);
      return { success: true, code };
    } catch (err: any) {
      console.error('[Baileys] Request pairing code exception:', err);
      return { success: false, error: err.message || 'Failed to request pairing code' };
    }
  }

  /**
   * Send a standard text message
   */
  public async sendMessage(toPhone: string, text: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.sock || this.status !== 'CONNECTED') {
      return { success: false, error: 'WhatsApp is not connected' };
    }

    const jid = this.formatJid(toPhone);
    try {
      const res = await this.sock.sendMessage(jid, { text });
      return { success: true, messageId: res?.key?.id || undefined };
    } catch (err: any) {
      console.error(`[Baileys] Send text error to ${toPhone}:`, err);
      return { success: false, error: err.message || String(err) };
    }
  }

  /**
   * Send interactive buttons (nativeFlowMessage: quick_reply, cta_url, cta_copy)
   */
  public async sendInteractiveButtons(
    toPhone: string,
    bodyText: string,
    buttons: BaileysButton[],
    headerTitle?: string,
    footerText = 'DS Dukan — 24/7 Gaming Shop'
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.sock || this.status !== 'CONNECTED') {
      return { success: false, error: 'WhatsApp is not connected' };
    }

    const jid = this.formatJid(toPhone);

    try {
      const nativeButtons = buttons.map(b => {
        if (b.type === 'url' && b.value) {
          return {
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
              display_text: b.title,
              url: b.value,
              merchant_url: b.value
            })
          };
        } else if (b.type === 'copy' && b.value) {
          return {
            name: 'cta_copy',
            buttonParamsJson: JSON.stringify({
              display_text: b.title,
              copy_code: b.value
            })
          };
        } else {
          return {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
              display_text: b.title,
              id: b.id
            })
          };
        }
      });

      const messageContent = {
        viewOnceMessage: {
          message: {
            interactiveMessage: proto.Message.InteractiveMessage.create({
              body: proto.Message.InteractiveMessage.Body.create({ text: bodyText }),
              footer: proto.Message.InteractiveMessage.Footer.create({ text: footerText }),
              header: headerTitle
                ? proto.Message.InteractiveMessage.Header.create({ title: headerTitle, hasMediaAttachment: false })
                : undefined,
              nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                buttons: nativeButtons
              })
            })
          }
        }
      };

      const waMsg = generateWAMessageFromContent(jid, messageContent, { userJid: this.sock.user?.id || jid });
      await this.sock.relayMessage(jid, waMsg.message!, { messageId: waMsg.key.id! });

      return { success: true, messageId: waMsg.key.id || undefined };
    } catch (err: any) {
      console.warn('[Baileys] Error sending nativeFlow buttons, falling back to clean formatted menu:', err);
      // Fallback: Format buttons as numbered list in text so user can reply with number
      const buttonList = buttons
        .map((b, idx) => `${idx + 1}️⃣ ${b.title}${b.type === 'url' && b.value ? `\n👉 ${b.value}` : ''}`)
        .join('\n');
      const fallbackText = `${headerTitle ? `*${headerTitle}*\n\n` : ''}${bodyText}\n\n${buttonList}\n\n_${footerText}_`;
      return this.sendMessage(toPhone, fallbackText);
    }
  }

  /**
   * Send single-select dropdown list (sections & rows)
   */
  public async sendInteractiveList(
    toPhone: string,
    bodyText: string,
    buttonText: string,
    sections: BaileysListSection[],
    headerTitle?: string,
    footerText = 'DS Dukan — 24/7 Gaming Shop'
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.sock || this.status !== 'CONNECTED') {
      return { success: false, error: 'WhatsApp is not connected' };
    }

    const jid = this.formatJid(toPhone);

    try {
      const listParams = {
        title: buttonText,
        sections: sections.map(s => ({
          title: s.title || 'Options',
          rows: s.rows.map(r => ({
            id: r.id,
            title: r.title,
            description: r.description || ''
          }))
        }))
      };

      const messageContent = {
        viewOnceMessage: {
          message: {
            interactiveMessage: proto.Message.InteractiveMessage.create({
              body: proto.Message.InteractiveMessage.Body.create({ text: bodyText }),
              footer: proto.Message.InteractiveMessage.Footer.create({ text: footerText }),
              header: headerTitle
                ? proto.Message.InteractiveMessage.Header.create({ title: headerTitle, hasMediaAttachment: false })
                : undefined,
              nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                buttons: [
                  {
                    name: 'single_select',
                    buttonParamsJson: JSON.stringify(listParams)
                  }
                ]
              })
            })
          }
        }
      };

      const waMsg = generateWAMessageFromContent(jid, messageContent, { userJid: this.sock.user?.id || jid });
      await this.sock.relayMessage(jid, waMsg.message!, { messageId: waMsg.key.id! });

      return { success: true, messageId: waMsg.key.id || undefined };
    } catch (err: any) {
      console.warn('[Baileys] Error sending nativeFlow list, falling back to formatted text:', err);
      let menuText = `${headerTitle ? `*${headerTitle}*\n\n` : ''}${bodyText}\n\n`;
      let counter = 1;
      for (const s of sections) {
        if (s.title) menuText += `*${s.title}*\n`;
        for (const r of s.rows) {
          menuText += `${counter}️⃣ ${r.title}${r.description ? ` (${r.description})` : ''}\n`;
          counter++;
        }
        menuText += '\n';
      }
      menuText += `_${footerText}_`;
      return this.sendMessage(toPhone, menuText.trim());
    }
  }

  /**
   * Send an image or photo message (e.g. login QR code screenshot)
   */
  public async sendImage(
    toPhone: string,
    imageSource: Buffer | string,
    caption?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.sock || this.status !== 'CONNECTED') {
      return { success: false, error: 'WhatsApp is not connected' };
    }

    const jid = this.formatJid(toPhone);
    try {
      const payload: AnyMessageContent = typeof imageSource === 'string'
        ? { image: { url: imageSource }, caption }
        : { image: imageSource, caption };

      const res = await this.sock.sendMessage(jid, payload);
      return { success: true, messageId: res?.key?.id || undefined };
    } catch (err: any) {
      console.error(`[Baileys] Send image error to ${toPhone}:`, err);
      return { success: false, error: err.message || String(err) };
    }
  }

  /**
   * Send a product or catalog message
   */
  public async sendProduct(
    toPhone: string,
    product: WASendableProduct,
    body?: string,
    footer = 'DS Dukan — 24/7 Gaming Shop'
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.sock || this.status !== 'CONNECTED') {
      return { success: false, error: 'WhatsApp is not connected' };
    }

    const jid = this.formatJid(toPhone);
    try {
      const res = await this.sock.sendMessage(jid, {
        product,
        body,
        footer,
        businessOwnerJid: this.sock.user?.id
      });
      return { success: true, messageId: res?.key?.id || undefined };
    } catch (err: any) {
      console.error(`[Baileys] Send product error to ${toPhone}:`, err);
      return { success: false, error: err.message || String(err) };
    }
  }

  /**
   * Send an interactive CTA URL button (opens external webpage directly)
   */
  public async sendInteractiveCtaUrl(
    toPhone: string,
    bodyText: string,
    buttonText: string,
    url: string,
    headerTitle?: string,
    footerText = 'DS Dukan — 24/7 Gaming Shop'
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return this.sendInteractiveButtons(
      toPhone,
      bodyText,
      [
        {
          id: 'cta_url_btn',
          title: buttonText,
          type: 'url',
          value: url
        }
      ],
      headerTitle,
      footerText
    );
  }

  /**
   * Manually trigger a socket reconnection
   */
  public async reconnect(): Promise<void> {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    try {
      if (this.sock) {
        this.sock.end(undefined);
      }
    } catch (e) {
      console.warn('[Baileys] Error ending sock on reconnect:', e);
    }
    this.sock = null;
    this.status = 'DISCONNECTED';
    this.currentQr = null;
    this.currentQrDataUrl = null;
    this.currentPairingCode = null;
    await this.init();
  }

  /**
   * Disconnect and clear credentials
   */
  public async logout(): Promise<void> {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    try {
      if (this.sock) {
        await this.sock.logout();
      }
    } catch (err) {
      console.warn('[Baileys] Logout error:', err);
    } finally {
      this.clearAuthFiles();
      this.sock = null;
      this.status = 'DISCONNECTED';
      this.currentQr = null;
      this.currentQrDataUrl = null;
      this.currentPairingCode = null;
      this.registeredPhone = null;
    }
  }

  private clearAuthFiles(): void {
    try {
      if (fs.existsSync(this.authPath)) {
        fs.rmSync(this.authPath, { recursive: true, force: true });
        this.ensureAuthDir();
      }
    } catch (err) {
      console.error('[Baileys] Error removing auth directory:', err);
    }
  }
}

// Global singleton for Next.js hot reload / process persistence
const globalForBaileys = globalThis as unknown as {
  __baileysManager?: BaileysManager;
};

export const baileysManager = globalForBaileys.__baileysManager || new BaileysManager();
globalForBaileys.__baileysManager = baileysManager;

