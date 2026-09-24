import { Conversation, Message, ConversationSessionState } from '@/types';
import { connectToDatabase, isDbConfigured } from '../client';
import { ConversationModel } from '../models/Conversation';
import { MessageModel } from '../models/Message';
import { UserModel } from '../models/User';
import { mockStore } from '../mock-store';
import { usersRepository } from './users';

export const chatRepository = {
  // SESSION STATES & MULTI-CUSTOMER MEMORY
  getSessionState(conversationId: string): ConversationSessionState {
    const defaultState: ConversationSessionState = {
      step: 'IDLE',
      draftOrder: { items: [] },
      lastInteractionTimestamp: Date.now()
    };

    const existing = mockStore.sessionStates.get(conversationId);
    if (!existing || !existing.draftOrder) {
      if (!existing) {
        console.warn(`[SessionState] Cold-start or missing session for conversationId=${conversationId}. Returning default IDLE state.`);
      }
      const merged: ConversationSessionState = {
        step: existing?.step || 'IDLE',
        draftOrder: (existing?.draftOrder && Array.isArray(existing.draftOrder.items))
          ? existing.draftOrder
          : { items: [] },
        lastOrderId: existing?.lastOrderId,
        lastInteractionTimestamp: existing?.lastInteractionTimestamp || Date.now()
      };
      mockStore.sessionStates.set(conversationId, merged);
      return merged;
    }

    // TTL check: 30 minutes of inactivity resets draft
    const thirtyMinutes = 30 * 60 * 1000;
    if (Date.now() - (existing.lastInteractionTimestamp || 0) > thirtyMinutes) {
      console.log(`[SessionState] TTL expired for conversationId=${conversationId}. Resetting to IDLE.`);
      mockStore.sessionStates.set(conversationId, defaultState);
      return defaultState;
    }

    return existing;
  },

  setSessionState(conversationId: string, updates: Partial<ConversationSessionState>): ConversationSessionState {
    const current = this.getSessionState(conversationId);
    const updated: ConversationSessionState = {
      ...current,
      ...updates,
      draftOrder: {
        ...current.draftOrder,
        ...(updates.draftOrder || {})
      },
      lastInteractionTimestamp: Date.now()
    };
    mockStore.sessionStates.set(conversationId, updated);

    // Asynchronously sync session state to MongoDB for serverless persistence
    if (isDbConfigured()) {
      connectToDatabase().then(() => {
        ConversationModel.updateOne(
          { id: conversationId },
          {
            $set: {
              draft_state: updated,
              updated_at: new Date().toISOString()
            }
          }
        ).catch(err => console.error('[State Sync] Error saving draft_state to MongoDB:', err));
      }).catch(() => {});
    }

    return updated;
  },

  clearSessionDraft(conversationId: string, lastOrderId?: string): void {
    const existing = this.getSessionState(conversationId);
    const clearedState: ConversationSessionState = {
      step: 'IDLE',
      draftOrder: { items: [] },
      lastOrderId: lastOrderId || existing.lastOrderId,
      lastInteractionTimestamp: Date.now()
    };
    mockStore.sessionStates.set(conversationId, clearedState);

    if (isDbConfigured()) {
      connectToDatabase().then(() => {
        ConversationModel.updateOne(
          { id: conversationId },
          {
            $set: {
              draft_state: clearedState,
              updated_at: new Date().toISOString()
            }
          }
        ).catch(() => {});
      }).catch(() => {});
    }
  },

  async updateConversationSummary(conversationId: string, summary: string): Promise<void> {
    if (isDbConfigured()) {
      try {
        await connectToDatabase();
        await ConversationModel.updateOne(
          { id: conversationId },
          { $set: { summary, updated_at: new Date().toISOString() } }
        );
      } catch (err) {}
    }
    const conv = mockStore.conversations.get(conversationId);
    if (conv) {
      conv.summary = summary;
    }
  },

  updateCustomerProfileSlot(conversationId: string, slot: {
    customerName?: string;
    customerPhone?: string;
    playerUid?: string;
    trxId?: string;
    paymentMethod?: string;
    customerNotes?: string;
  }): ConversationSessionState {
    const current = this.getSessionState(conversationId);
    return this.setSessionState(conversationId, {
      draftOrder: {
        ...current.draftOrder,
        ...slot
      }
    });
  },

  // CONVERSATIONS & CHAT HISTORY
  async getConversations(): Promise<Conversation[]> {
    if (isDbConfigured()) {
      try {
        await connectToDatabase();
        const convDocs = await ConversationModel.find().sort({ last_message_at: -1 }).lean();
        if (convDocs && convDocs.length > 0) {
          const convIds = convDocs.map(c => c.id);
          const userIds = convDocs.map(c => c.user_id).filter((id): id is string => Boolean(id));

          const [allMessages, allUsers] = await Promise.all([
            MessageModel.find({ conversation_id: { $in: convIds } }).sort({ created_at: 1 }).lean(),
            UserModel.find({ id: { $in: userIds } }).lean()
          ]);

          const normalizeSender = (raw: string): 'CUSTOMER' | 'BOT' | 'ADMIN' => {
            if (raw === 'USER' || raw === 'CUSTOMER') return 'CUSTOMER';
            if (raw === 'AGENT' || raw === 'ADMIN' || raw === 'HUMAN_AGENT') return 'ADMIN';
            return 'BOT';
          };

          const messagesByConv = new Map<string, any[]>();
          for (const msg of allMessages) {
            const list = messagesByConv.get(msg.conversation_id) || [];
            list.push({
              ...msg,
              sender: normalizeSender(msg.sender)
            });
            messagesByConv.set(msg.conversation_id, list);
          }

          const userById = new Map<string, any>();
          for (const u of allUsers) {
            userById.set(u.id, u);
          }

          return convDocs.map((c: any) => {
            const session = mockStore.sessionStates.get(c.id) || c.draft_state;
            return {
              ...c,
              channel: 'WHATSAPP' as const,
              is_ai_active: c.current_mode !== 'HUMAN',
              user: c.user_id ? userById.get(c.user_id) : undefined,
              messages: messagesByConv.get(c.id) || [],
              draft_state: session,
              session_state: session
            };
          });
        }
      } catch (err) {
        console.error('[MongoDB getConversations error]:', err);
      }
    }

    return Array.from(mockStore.conversations.values()).map(c => {
      const messages = Array.from(mockStore.messages.values())
        .filter(m => m.conversation_id === c.id)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const session = mockStore.sessionStates.get(c.id) || c.draft_state;
      return {
        ...c,
        messages,
        draft_state: session,
        session_state: session
      };
    });
  },

  async getConversationById(conversationId: string): Promise<Conversation | null> {
    const normalizeSender = (raw: string): 'CUSTOMER' | 'BOT' | 'ADMIN' => {
      if (raw === 'USER' || raw === 'CUSTOMER') return 'CUSTOMER';
      if (raw === 'AGENT' || raw === 'ADMIN' || raw === 'HUMAN_AGENT') return 'ADMIN';
      return 'BOT';
    };

    if (isDbConfigured()) {
      try {
        await connectToDatabase();
        const convDoc = await ConversationModel.findOne({ id: conversationId }).lean();
        if (convDoc) {
          if (convDoc.draft_state && convDoc.draft_state.draftOrder && !mockStore.sessionStates.has(convDoc.id)) {
            mockStore.sessionStates.set(convDoc.id, convDoc.draft_state);
          }

          const [messages, user] = await Promise.all([
            MessageModel.find({ conversation_id: conversationId }).sort({ created_at: 1 }).lean(),
            convDoc.user_id ? UserModel.findOne({ id: convDoc.user_id }).lean() : null
          ]);

          const session = mockStore.sessionStates.get(convDoc.id) || convDoc.draft_state;

          return {
            ...convDoc,
            user_id: convDoc.user_id || '',
            channel: 'WHATSAPP' as const,
            is_ai_active: convDoc.current_mode !== 'HUMAN',
            user: user as any,
            messages: (messages as any[] || []).map((m: any) => ({
              ...m,
              sender: normalizeSender(m.sender)
            })),
            draft_state: session,
            session_state: session
          } as Conversation;
        }
      } catch (err) {
        console.error('[MongoDB getConversationById error]:', err);
      }
    }

    const conv = mockStore.conversations.get(conversationId);
    if (!conv) return null;
    const messages = Array.from(mockStore.messages.values())
      .filter(m => m.conversation_id === conversationId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const session = mockStore.sessionStates.get(conversationId) || conv.draft_state;
    return {
      ...conv,
      messages,
      draft_state: session,
      session_state: session
    };
  },

  async getOrCreateConversation(phone: string, userName?: string): Promise<Conversation> {
    const user = await usersRepository.getOrCreateUser(phone, userName);
    const cleanPhone = usersRepository.normalizePhoneNumber(phone);

    if (isDbConfigured()) {
      try {
        await connectToDatabase();
        let convDoc = await ConversationModel.findOne({
          $or: [
            { user_id: user.id },
            { phone: cleanPhone },
            { phone: cleanPhone.replace(/^\+/, '') }
          ]
        }).lean();

        if (convDoc) {
          if (convDoc.draft_state && convDoc.draft_state.draftOrder && !mockStore.sessionStates.has(convDoc.id)) {
            mockStore.sessionStates.set(convDoc.id, convDoc.draft_state);
          }
          const messages = await MessageModel.find({ conversation_id: convDoc.id }).sort({ created_at: 1 }).lean();
          return {
            ...convDoc,
            user_id: convDoc.user_id || user.id,
            channel: 'WHATSAPP' as const,
            is_ai_active: convDoc.current_mode !== 'HUMAN',
            user,
            messages: (messages as any) || []
          } as Conversation;
        }

        const newConvId = crypto.randomUUID();
        const nowIso = new Date().toISOString();
        const createdDoc = await ConversationModel.create({
          id: newConvId,
          phone: cleanPhone,
          user_id: user.id,
          current_mode: 'BOT',
          last_message_at: nowIso,
          created_at: nowIso,
          updated_at: nowIso
        });

        return {
          id: createdDoc.id,
          user_id: user.id,
          channel: 'WHATSAPP',
          is_ai_active: true,
          last_message_at: nowIso,
          created_at: nowIso,
          user,
          messages: []
        };
      } catch (err) {
        console.error('[MongoDB getOrCreateConversation error]:', err);
      }
    }

    for (const c of mockStore.conversations.values()) {
      if (c.user_id === user.id) {
        const messages = Array.from(mockStore.messages.values())
          .filter(m => m.conversation_id === c.id)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        return {
          ...c,
          user,
          messages
        };
      }
    }

    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      user_id: user.id,
      channel: 'WHATSAPP',
      is_ai_active: true,
      last_message_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      user,
      messages: []
    };
    mockStore.conversations.set(newConv.id, newConv);
    return newConv;
  },

  async addMessage(
    conversationIdOrParams: string | {
      conversationId: string;
      sender: 'CUSTOMER' | 'AI_AGENT' | 'HUMAN_AGENT' | 'BOT' | 'ADMIN' | string;
      content: string;
      metadata?: Record<string, any>;
    },
    senderArg?: 'CUSTOMER' | 'AI_AGENT' | 'HUMAN_AGENT' | 'BOT' | 'ADMIN' | string,
    contentArg?: string,
    metadataArg?: Record<string, any>
  ): Promise<Message> {
    let conversationId: string;
    let senderRaw: string;
    let content: string;
    let metadata: Record<string, any> = {};

    if (typeof conversationIdOrParams === 'object') {
      conversationId = conversationIdOrParams.conversationId;
      senderRaw = conversationIdOrParams.sender;
      content = conversationIdOrParams.content;
      metadata = conversationIdOrParams.metadata || {};
    } else {
      conversationId = conversationIdOrParams;
      senderRaw = senderArg || 'CUSTOMER';
      content = contentArg || '';
      metadata = metadataArg || {};
    }

    let sender: 'CUSTOMER' | 'BOT' | 'ADMIN' = 'CUSTOMER';
    if (senderRaw === 'BOT' || senderRaw === 'AI_AGENT') {
      sender = 'BOT';
    } else if (senderRaw === 'ADMIN' || senderRaw === 'HUMAN_AGENT') {
      sender = 'ADMIN';
    }

    const msgId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const newMsg: Message = {
      id: msgId,
      conversation_id: conversationId,
      sender,
      content,
      raw_payload: metadata,
      created_at: nowIso
    };

    if (isDbConfigured()) {
      try {
        await connectToDatabase();
        await MessageModel.create({
          id: msgId,
          conversation_id: conversationId,
          sender: sender === 'CUSTOMER' ? 'USER' : sender === 'BOT' ? 'BOT' : 'AGENT',
          content,
          metadata,
          created_at: nowIso
        });

        await ConversationModel.updateOne(
          { id: conversationId },
          { $set: { last_message_at: nowIso, updated_at: nowIso } }
        );

        return newMsg;
      } catch (err) {
        console.error('[MongoDB addMessage error]:', err);
      }
    }

    mockStore.messages.set(msgId, newMsg);
    const conv = mockStore.conversations.get(conversationId);
    if (conv) {
      conv.last_message_at = newMsg.created_at;
      if (!conv.messages) conv.messages = [];
      conv.messages.push(newMsg);
    }
    return newMsg;
  },

  async setAiMode(conversationId: string, isAiActive: boolean): Promise<void> {
    if (isDbConfigured()) {
      try {
        await connectToDatabase();
        await ConversationModel.updateOne(
          { id: conversationId },
          {
            $set: {
              current_mode: isAiActive ? 'BOT' : 'HUMAN',
              updated_at: new Date().toISOString()
            }
          }
        );
      } catch (err) {}
    }
    const conv = mockStore.conversations.get(conversationId);
    if (conv) {
      (conv as any).is_ai_active = isAiActive;
    }
  },

  async updateCustomerTag(userId: string, tag: 'VIP' | 'REGULAR' | 'FLAGGED'): Promise<void> {
    await usersRepository.updateUserStatus(userId, tag);
  }
};
