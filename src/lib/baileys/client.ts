process.env['WS_NO_BUFFER_UTIL'] = '1';
process.env['WS_NO_UTF_8_VALIDATE'] = '1';

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  fetchLatestWaWebVersion,
  Browsers,
  WASocket,
  proto,
  generateWAMessageFromContent,
  WASendableProduct,
  AnyMessageContent,
  jidDecode,
  jidNormalizedUser
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
  private connectWatchdog: NodeJS.Timeout | null = null;
  private isInitializing = false;
  /** Monotonic lock id so aborted inits cannot leave isInitializing stuck true. */
  private initLockId = 0;
  /** Bumps on every new socket so stale connection.update handlers cannot start a second reconnect. */
  private connectGeneration = 0;
  private lastError: string | null = null;
  private messageHandler: ((message: proto.IWebMessageInfo) => Promise<void>) | null = null;
  /** Lightweight outbound message cache for Baileys retry / getMessage. */
  private messageStore = new Map<string, proto.IMessage>();
  /**
   * WhatsApp identifies contacts by JID, which since 2024 can be either a
   * phone-number JID (`@s.whatsapp.net`) or an anonymized LID (`@lid`) — see
   * https://baileys.wiki/concepts/jids. Our app stores/passes around a plain
   * "+digits" phone string everywhere (DB keys, order records, UI), which loses
   * the `@lid` vs `@s.whatsapp.net` distinction. If we guess `@s.whatsapp.net`
   * for a contact that actually messaged us via `@lid`, the reply is addressed
   * to a JID that doesn't exist — Baileys still reports success (it only
   * confirms relay acceptance, not delivery), so replies silently vanish.
   * This cache remembers the REAL JID a contact last messaged us from, keyed
   * by the numeric "user" portion, so outbound sends always target the
   * correct address regardless of PN/LID.
   */
  private knownJids = new Map<string, string>();

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

  /**
   * Remember the real JID (PN or LID) a contact messaged us from, so replies
   * to that contact target the correct address instead of a guessed one.
   * @see https://baileys.wiki/concepts/jids
   */
  public rememberContactJid(jid: string | null | undefined): void {
    if (!jid) return;
    const decoded = jidDecode(jid);
    if (!decoded?.user || !decoded.server) return;
    // Drop the device suffix (":N") — we only key on the user identity.
    const key = decoded.user;
    const normalized = jidNormalizedUser(jid);
    this.knownJids.set(key, normalized);
    if (this.knownJids.size > 2000) {
      const first = this.knownJids.keys().next().value;
      if (first) this.knownJids.delete(first);
    }
  }

  /**
   * Build the JID to send to for a given "phone" string.
   * - If already a full JID (contains '@'), normalize and use as-is.
   * - If we've previously received a message from this contact, reuse the
   *   exact JID (PN or LID) it messaged us from — this is the only reliable
   *   way to address a `@lid` contact, since LIDs cannot be derived from a
   *   phone number.
   * - Otherwise fall back to the legacy phone-number JID (correct for
   *   admin-triggered sends to a known phone number that hasn't messaged us).
   */
  public formatJid(phone: string): string {
    if (phone.includes('@')) {
      return jidNormalizedUser(phone);
    }
    const clean = phone.replace(/\D/g, '');
    const known = this.knownJids.get(clean);
    if (known) return known;
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
      authDir: this.authPath,
      isInitializing: this.isInitializing,
      hasPendingReconnect: this.reconnectTimer !== null,
      reconnectAttempts: this.reconnectAttempts,
      lastError: this.lastError,
      hasSocket: this.sock !== null,
    };
  }

  /**
   * True when a healthy connect is already in progress or connected.
   * Zombie CONNECTING with no socket is NOT busy — recovery must be allowed.
   */
  public get isBusy(): boolean {
    if (this.status === 'CONNECTED') return true;
    if (this.status === 'QR_READY' || this.status === 'PAIRING_CODE_READY') return true;
    if (this.reconnectTimer !== null) return true;
    if (this.isInitializing && this.sock !== null) return true;
    if (this.isInitializing && this.status === 'CONNECTING') return true;
    return false;
  }

  private clearConnectWatchdog(): void {
    if (this.connectWatchdog) {
      clearTimeout(this.connectWatchdog);
      this.connectWatchdog = null;
    }
  }

  /** Fast, bounded peek at creds.json — avoids trusting a hung useMultiFileAuthState read. */
  private hasRegisteredCreds(): boolean {
    try {
      const credsPath = path.join(this.authPath, 'creds.json');
      if (!fs.existsSync(credsPath)) return false;
      const raw = fs.readFileSync(credsPath, 'utf8');
      return Boolean(JSON.parse(raw)?.registered);
    } catch {
      return false;
    }
  }

  /** If we sit in CONNECTING with no QR/open for too long, force a clean retry (often corrupt/stuck auth). */
  private armConnectWatchdog(generation: number): void {
    this.clearConnectWatchdog();
    this.connectWatchdog = setTimeout(() => {
      this.connectWatchdog = null;
      if (generation !== this.connectGeneration) return;
      if (this.status === 'CONNECTED' || this.status === 'QR_READY' || this.status === 'PAIRING_CODE_READY') {
        return;
      }

      // Don't destroy a real linked session just because this attempt is slow —
      // only wipe auth when there is no completed pairing to lose.
      const registered = this.hasRegisteredCreds();
      if (registered) {
        console.warn(
          '[Baileys] ⏱️ Connect watchdog: registered session stuck 45s with no open event. Retrying without wiping auth...'
        );
        this.lastError = 'Reconnect is taking longer than expected. Retrying...';
      } else {
        console.warn(
          '[Baileys] ⏱️ Connect watchdog: no QR/open after 45s and no registered session. Clearing auth and retrying...'
        );
        this.lastError = 'Connection timed out waiting for QR. Cleared session and retrying.';
        this.clearAuthFiles();
      }

      this.destroySocket('watchdog');
      this.status = 'DISCONNECTED';
      this.isInitializing = false;
      this.scheduleReconnect(1000);
    }, 45_000);
  }

  /**
   * Tear down the active socket cleanly so a new makeWASocket cannot fight it (440 connectionReplaced).
   */
  private destroySocket(reason = 'replace'): void {
    const sock = this.sock;
    this.sock = null;
    if (!sock) return;

    try {
      sock.ev.removeAllListeners('connection.update');
      sock.ev.removeAllListeners('creds.update');
      sock.ev.removeAllListeners('messages.upsert');
    } catch {
      // ignore
    }

    try {
      // end() closes the WS without logging out of WhatsApp (creds stay on disk).
      sock.end(undefined);
    } catch (err) {
      console.warn(`[Baileys] destroySocket(${reason}) end error:`, err);
    }
  }

  private rememberMessage(msg: proto.IWebMessageInfo | undefined | null): void {
    if (!msg?.key?.id || !msg.message) return;
    const id = `${msg.key.remoteJid || ''}:${msg.key.id}`;
    this.messageStore.set(id, msg.message);
    if (this.messageStore.size > 500) {
      const first = this.messageStore.keys().next().value;
      if (first) this.messageStore.delete(first);
    }
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Force-unlock any zombie init state, then start a fresh socket.
   */
  public async forceInit(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.clearConnectWatchdog();
    this.connectGeneration++;
    this.isInitializing = false;
    this.destroySocket('force-init');
    this.status = 'DISCONNECTED';
    this.currentQr = null;
    this.currentQrDataUrl = null;
    this.currentPairingCode = null;
    await this.init();
  }

  /**
   * Start Baileys socket connection.
   * Single-flight: never create a second socket while one is connecting or reconnecting.
   * @see https://baileys.wiki/advanced/troubleshooting#connection-keeps-dropping-/-reconnecting
   */
  public async init(): Promise<void> {
    // Recover from zombie lock (previous init aborted without clearing the flag)
    if (this.isInitializing) {
      if (this.sock && (this.status === 'CONNECTING' || this.status === 'QR_READY' || this.status === 'PAIRING_CODE_READY' || this.status === 'CONNECTED')) {
        console.log(`[Baileys] init() skipped — already in status=${this.status}`);
        return;
      }
      console.warn('[Baileys] Clearing zombie isInitializing lock (no live socket)');
      this.isInitializing = false;
    }

    if (this.sock && this.status === 'CONNECTED') {
      return;
    }
    if (this.sock && (this.status === 'QR_READY' || this.status === 'PAIRING_CODE_READY')) {
      console.log(`[Baileys] init() skipped — socket already in status=${this.status}`);
      return;
    }

    const myLock = ++this.initLockId;
    this.isInitializing = true;
    this.status = 'CONNECTING';
    this.lastError = null;
    const generation = ++this.connectGeneration;

    this.destroySocket('before-init');

    // Bound the ENTIRE init flow, including the pre-socket phase. Without this,
    // a hang in useMultiFileAuthState (corrupt/huge auth dir, stuck disk I/O)
    // leaves isInitializing=true / hasSocket=false forever — no socket, no QR,
    // and the post-socket QR watchdog below never gets a chance to arm.
    this.armConnectWatchdog(generation);

    try {
      this.ensureAuthDir();
      const { state, saveCreds } = await this.withTimeout(
        useMultiFileAuthState(this.authPath),
        15_000,
        'useMultiFileAuthState'
      );

      if (generation !== this.connectGeneration || myLock !== this.initLockId) {
        console.log('[Baileys] init aborted — superseded by a newer connect attempt');
        return;
      }

      const logger = pino({ level: 'error' });

      let version: [number, number, number] | undefined;
      try {
        const versionInfo = await this.withTimeout(
          fetchLatestWaWebVersion({}),
          8_000,
          'fetchLatestWaWebVersion'
        );
        version = versionInfo.version;
        console.log(`[Baileys] Using live WA Web version: ${version.join('.')}`);
      } catch (liveErr) {
        console.warn('[Baileys] Live WA Web version fetch failed/timed out:', (liveErr as Error)?.message || liveErr);
        try {
          const fallback = await this.withTimeout(fetchLatestBaileysVersion(), 5_000, 'fetchLatestBaileysVersion');
          version = fallback.version;
          console.warn(`[Baileys] Using bundled Baileys version: ${version.join('.')}`);
        } catch (vErr) {
          console.warn('[Baileys] All version fetches failed, using library default:', vErr);
        }
      }

      if (generation !== this.connectGeneration || myLock !== this.initLockId) {
        console.log('[Baileys] init aborted after version fetch — superseded');
        return;
      }

      const isRegistered = Boolean(state.creds?.registered);
      console.log(`[Baileys] Creating socket (registered=${isRegistered}, authDir=${this.authPath})`);

      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        logger,
        browser: Browsers.macOS('Chrome'),
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
        connectTimeoutMs: 60_000,
        defaultQueryTimeoutMs: 60_000,
        keepAliveIntervalMs: 30_000,
        markOnlineOnConnect: false,
        retryRequestDelayMs: 250,
        getMessage: async (key) => {
          const id = `${key.remoteJid || ''}:${key.id || ''}`;
          return this.messageStore.get(id);
        },
      });

      this.armConnectWatchdog(generation);

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        if (generation !== this.connectGeneration) return;

        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.clearConnectWatchdog();
          this.currentQr = qr;
          try {
            this.currentQrDataUrl = await QRCode.toDataURL(qr);
          } catch (qrErr) {
            console.error('[Baileys] QR DataURL generation error:', qrErr);
            this.lastError = 'Failed to render QR image';
          }
          this.status = 'QR_READY';
          this.lastError = null;
          console.log('[Baileys] New QR Code generated. Scan from WhatsApp or Admin panel.');
        }

        if (connection === 'open') {
          this.clearConnectWatchdog();
          this.status = 'CONNECTED';
          this.currentQr = null;
          this.currentQrDataUrl = null;
          this.currentPairingCode = null;
          this.reconnectAttempts = 0;
          this.lastError = null;
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          this.registeredPhone = this.sock?.user?.id ? this.sock.user.id.split(':')[0] : null;
          console.log(`[Baileys] ✅ Connection open! Connected as: ${this.registeredPhone}`);
        } else if (connection === 'close') {
          this.clearConnectWatchdog();
          this.status = 'DISCONNECTED';
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const errorMessage = (lastDisconnect?.error as Boom)?.message || 'Unknown';
          this.lastError = `Disconnected (${statusCode}): ${errorMessage}`;

          const shouldReconnect =
            statusCode !== DisconnectReason.loggedOut &&
            statusCode !== DisconnectReason.connectionReplaced;

          console.warn(
            `[Baileys] 🔌 Connection closed. Code: ${statusCode}, Message: "${errorMessage}". Reconnecting: ${shouldReconnect}`
          );

          if (generation === this.connectGeneration) {
            this.sock = null;
          }

          if (statusCode === DisconnectReason.loggedOut) {
            console.warn('[Baileys] Device was logged out (401). Clearing auth credentials...');
            this.clearAuthFiles();
            this.currentQr = null;
            this.currentQrDataUrl = null;
            this.currentPairingCode = null;
            this.registeredPhone = null;
            return;
          }

          if (statusCode === DisconnectReason.connectionReplaced) {
            console.warn(
              '[Baileys] Connection replaced (440). Waiting 15s before a single recovery attempt...'
            );
            this.scheduleReconnect(15_000);
            return;
          }

          if (statusCode === DisconnectReason.badSession) {
            console.warn('[Baileys] Bad session detected (500). Clearing invalid session files...');
            this.clearAuthFiles();
            this.scheduleReconnect();
            return;
          }

          if (statusCode === DisconnectReason.restartRequired) {
            console.log(
              '[Baileys] 🔄 WhatsApp requested stream restart (515). Reconnecting immediately...'
            );
            this.reconnectAttempts = 0;
            this.scheduleReconnect(500);
            return;
          }

          if (shouldReconnect) {
            this.scheduleReconnect();
          }
        }
      });

      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (generation !== this.connectGeneration) return;
        if (type !== 'notify') return;
        for (const msg of messages) {
          this.rememberMessage(msg);
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

      // Delivery/read receipts for OUR outbound messages. A successful
      // relayMessage/sendMessage only means WhatsApp's server accepted the
      // relay — it does NOT mean a real device received it (e.g. the classic
      // "sent to a nonexistent @lid JID" failure mode). These receipts are
      // the only real proof a message actually reached the customer's phone.
      this.sock.ev.on('messages.update', (updates) => {
        if (generation !== this.connectGeneration) return;
        for (const { key, update } of updates) {
          if (!key?.fromMe || update.status == null) continue;
          const label =
            { 1: 'PENDING', 2: 'SERVER_ACK', 3: 'DELIVERED', 4: 'READ', 5: 'PLAYED' }[
              update.status as number
            ] || `STATUS_${update.status}`;
          console.log(`[Baileys] 📬 ${label} — to=${key.remoteJid} id=${key.id}`);
        }
      });

    } catch (err) {
      console.error('[Baileys] Initialization error:', err);
      this.lastError = (err as Error)?.message || String(err);
      this.status = 'DISCONNECTED';
      this.clearConnectWatchdog();
      this.scheduleReconnect();
    } finally {
      // Always release if we still own this lock — prevents permanent CONNECTING stuck state
      if (myLock === this.initLockId) {
        this.isInitializing = false;
      }
    }
  }

  private scheduleReconnect(forcedDelayMs?: number): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectAttempts++;
    const delay =
      forcedDelayMs ??
      Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 30_000);
    console.log(
      `[Baileys] Scheduling reconnect in ${Math.round(delay / 1000)}s (Attempt #${this.reconnectAttempts})...`
    );
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.status === 'CONNECTED') return;
      // Allow recovery even if a previous init left a zombie lock
      this.isInitializing = false;
      this.destroySocket('reconnect');
      await this.init();
    }, delay);
  }

  /**
   * Request an 8-digit Pairing Code for headless phone linking
   * @see https://baileys.wiki/authentication/pairing-code
   */
  public async requestPairingCode(phone: string): Promise<{ success: boolean; code?: string; error?: string }> {
    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) {
      return { success: false, error: 'Phone number is required.' };
    }

    if (cleanPhone.startsWith('01') && cleanPhone.length === 11) {
      cleanPhone = '88' + cleanPhone;
    }

    if (cleanPhone.length < 8) {
      return { success: false, error: 'Invalid phone number format. Please include country code (e.g. 88017XXXXXXXX)' };
    }

    if (this.status === 'CONNECTED') {
      return { success: false, error: 'WhatsApp is already connected!' };
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Ensure a live socket exists (force if zombie CONNECTING)
    if (!this.sock || this.status === 'DISCONNECTED') {
      await this.forceInit();
    } else if (this.status === 'CONNECTING' && !this.sock) {
      await this.forceInit();
    }

    // Wait for socket + WA handshake (QR event means server linked pairing refs)
    let waitCount = 0;
    while (waitCount < 40) {
      if (this.sock && (this.currentQr || this.status === 'QR_READY' || this.status === 'PAIRING_CODE_READY')) {
        break;
      }
      if (this.sock && !this.isInitializing && this.status !== 'CONNECTING') {
        break;
      }
      // Sock exists and init finished — enough for pairing code even before QR paints
      if (this.sock && !this.isInitializing && waitCount >= 6) {
        break;
      }
      await new Promise(r => setTimeout(r, 500));
      waitCount++;
    }

    try {
      if (!this.sock) {
        return {
          success: false,
          error: this.lastError
            ? `Socket initialization failed: ${this.lastError}`
            : 'Socket initialization failed. Click "Reset / Clear Session" then try again.',
        };
      }

      if (this.sock.authState?.creds?.registered) {
        return {
          success: false,
          error: 'This session already has credentials. Click "Reset / Clear Session" first, then request a new code.',
        };
      }

      const code = await this.sock.requestPairingCode(cleanPhone);
      this.clearConnectWatchdog();
      this.currentPairingCode = code;
      this.status = 'PAIRING_CODE_READY';
      this.lastError = null;
      console.log(`[Baileys] 📲 Generated Pairing Code: ${code} for phone: ${cleanPhone}`);
      return { success: true, code };
    } catch (err: any) {
      console.error('[Baileys] Request pairing code exception:', err);
      this.lastError = err.message || String(err);
      return { success: false, error: err.message || 'Failed to request pairing code' };
    }
  }

  /**
   * Outbound sends are network round-trips through libsignal (session setup, prekey fetch, etc).
   * Without a hard ceiling, a stalled encrypt/relay (common right after a fresh pairing while
   * WhatsApp is still propagating our device's prekeys) hangs the caller FOREVER with zero
   * visibility — no success log, no error log, nothing. Bound every outbound call so a hang
   * always surfaces as a clear, loggable failure within OUTBOUND_SEND_TIMEOUT_MS.
   */
  private static readonly OUTBOUND_SEND_TIMEOUT_MS = 25_000;

  /**
   * Send a standard text message
   */
  public async sendMessage(toPhone: string, text: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.sock || this.status !== 'CONNECTED') {
      return { success: false, error: 'WhatsApp is not connected' };
    }

    const jid = this.formatJid(toPhone);
    try {
      const res = await this.withTimeout(
        this.sock.sendMessage(jid, { text }),
        BaileysManager.OUTBOUND_SEND_TIMEOUT_MS,
        `sendMessage(${toPhone})`
      );
      this.rememberMessage(res as proto.IWebMessageInfo);
      console.log(`[Baileys] ✉️ Text sent to ${toPhone} (id=${res?.key?.id || 'n/a'})`);
      return { success: true, messageId: res?.key?.id || undefined };
    } catch (err: any) {
      console.error(`[Baileys] Send text error to ${toPhone}:`, err.message || err);
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
      await this.withTimeout(
        this.sock.relayMessage(jid, waMsg.message!, { messageId: waMsg.key.id! }),
        BaileysManager.OUTBOUND_SEND_TIMEOUT_MS,
        `sendInteractiveButtons(${toPhone})`
      );

      console.log(`[Baileys] ✉️ Buttons sent to ${toPhone} (id=${waMsg.key.id || 'n/a'})`);
      return { success: true, messageId: waMsg.key.id || undefined };
    } catch (err: any) {
      console.warn(`[Baileys] Error sending nativeFlow buttons to ${toPhone}, falling back to formatted text:`, err.message || err);
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
      await this.withTimeout(
        this.sock.relayMessage(jid, waMsg.message!, { messageId: waMsg.key.id! }),
        BaileysManager.OUTBOUND_SEND_TIMEOUT_MS,
        `sendInteractiveList(${toPhone})`
      );

      console.log(`[Baileys] ✉️ List sent to ${toPhone} (id=${waMsg.key.id || 'n/a'})`);
      return { success: true, messageId: waMsg.key.id || undefined };
    } catch (err: any) {
      console.warn(`[Baileys] Error sending nativeFlow list to ${toPhone}, falling back to formatted text:`, err.message || err);
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

      const res = await this.withTimeout(
        this.sock.sendMessage(jid, payload),
        BaileysManager.OUTBOUND_SEND_TIMEOUT_MS,
        `sendImage(${toPhone})`
      );
      console.log(`[Baileys] 🖼️ Image sent to ${toPhone} (id=${res?.key?.id || 'n/a'})`);
      return { success: true, messageId: res?.key?.id || undefined };
    } catch (err: any) {
      console.error(`[Baileys] Send image error to ${toPhone}:`, err.message || err);
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
    await this.forceInit();
  }

  /**
   * Reset session: wipe auth directory and start a fresh socket
   */
  public async resetSession(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.clearConnectWatchdog();
    this.connectGeneration++;
    this.destroySocket('reset');
    this.clearAuthFiles();
    this.sock = null;
    this.status = 'DISCONNECTED';
    this.currentQr = null;
    this.currentQrDataUrl = null;
    this.currentPairingCode = null;
    this.registeredPhone = null;
    this.reconnectAttempts = 0;
    this.isInitializing = false;
    this.lastError = null;
    this.messageStore.clear();
    await this.init();
  }

  /**
   * Disconnect and clear credentials
   */
  public async logout(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.clearConnectWatchdog();
    this.connectGeneration++;
    try {
      if (this.sock) {
        await this.sock.logout();
      }
    } catch (err) {
      console.warn('[Baileys] Logout error:', err);
    } finally {
      this.destroySocket('logout');
      this.clearAuthFiles();
      this.status = 'DISCONNECTED';
      this.currentQr = null;
      this.currentQrDataUrl = null;
      this.currentPairingCode = null;
      this.registeredPhone = null;
      this.isInitializing = false;
      this.lastError = null;
      this.messageStore.clear();
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

