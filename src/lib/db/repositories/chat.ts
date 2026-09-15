import { Conversation, Message, ConversationSessionState } from '@/types';
import { getDbClient, isSupabaseConfigured } from '../client';
import { mockStore } from '../mock-store';
import { usersRepository } from './users';

export const chatRepository = {
  // SESSION STATES & MULTI-CUSTOMER MEMORY
  // SESSION STATES & MULTI-CUSTOMER MEMORY
  getSessionState(conversationId: string): ConversationSessionState {
    const defaultState: ConversationSessionState = {
      step: 'IDLE',
      draftOrder: { items: [] },
      lastInteractionTimestamp: Date.now()
    };

    const existing = mockStore.sessionStates.get(conversationId);
    if (!existing) {
      mockStore.sessionStates.set(conversationId, defaultState);
      return defaultState;
    }

    // TTL check: 30 minutes of inactivity resets draft
    const thirtyMinutes = 30 * 60 * 1000;
    if (Date.now() - existing.lastInteractionTimestamp > thirtyMinutes) {
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
      parallelDrafts: updates.parallelDrafts !== undefined ? updates.parallelDrafts : current.parallelDrafts,
      lastCreatedOrders: updates.lastCreatedOrders !== undefined ? updates.lastCreatedOrders : current.lastCreatedOrders,
      lastInteractionTimestamp: Date.now()
    };
    mockStore.sessionStates.set(conversationId, updated);

    // Asynchronously sync session state to Supabase conversations table for serverless persistence
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      Promise.resolve(
        client
          .from('conversations')
          .update({
            draft_state: updated,
            updated_at: new Date().toISOString()
          })
          .eq('id', conversationId)
      ).catch((err: any) => console.error('[State Sync] Error saving draft_state to Supabase:', err));
    }

    return updated;
  },

  clearSessionDraft(conversationId: string, lastOrderId?: string): void {
    const existing = this.getSessionState(conversationId);
    const clearedState: ConversationSessionState = {
      step: 'IDLE',
      draftOrder: { items: [] },
      parallelDrafts: undefined,
      lastOrderId: lastOrderId || existing.lastOrderId,
      lastCreatedOrders: existing.lastCreatedOrders,
      lastInteractionTimestamp: Date.now()
    };
    mockStore.sessionStates.set(conversationId, clearedState);

    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      Promise.resolve(
        client
          .from('conversations')
          .update({
            draft_state: clearedState,
            updated_at: new Date().toISOString()
          })
          .eq('id', conversationId)
      ).catch(() => {});
    }
  },

  async updateConversationSummary(conversationId: string, summary: string): Promise<void> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      await client
        .from('conversations')
        .update({ summary })
        .eq('id', conversationId);
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
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      try {
        const { data, error } = await client
          .from('conversations')
          .select(`
            *,
            customer:users(*),
            messages(*)
          `)
          .order('last_message_at', { ascending: false });

        if (!error && data) {
          return data.map((c: any) => ({
            ...c,
            user: c.customer,
            messages: (c.messages || []).sort(
              (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            )
          }));
        }
      } catch (err) {
        console.error('Supabase getConversations error:', err);
      }
    }

    return Array.from(mockStore.conversations.values()).map(c => {
      const messages = Array.from(mockStore.messages.values())
        .filter(m => m.conversation_id === c.id)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      return {
        ...c,
        messages
      };
    });
  },

  async getConversationById(conversationId: string): Promise<Conversation | null> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      try {
        const { data, error } = await client
          .from('conversations')
          .select(`
            *,
            customer:users(*),
            messages(*)
          `)
          .eq('id', conversationId)
          .single();

        if (!error && data) {
          if (data.draft_state && !mockStore.sessionStates.has(data.id)) {
            mockStore.sessionStates.set(data.id, data.draft_state);
          }
          const sortedMessages = (data.messages || []).sort(
            (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          return {
            ...data,
            user: data.customer,
            messages: sortedMessages
          };
        }
      } catch (err) {
        console.error('Supabase getConversationById error:', err);
      }
    }

    const conv = mockStore.conversations.get(conversationId);
    if (!conv) return null;
    const messages = Array.from(mockStore.messages.values())
      .filter(m => m.conversation_id === conversationId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return {
      ...conv,
      messages
    };
  },

  async getOrCreateConversation(phone: string, userName?: string): Promise<Conversation> {
    const user = await usersRepository.getOrCreateUser(phone, userName);
    const client = getDbClient();

    if (isSupabaseConfigured() && client) {
      const { data } = await client
        .from('conversations')
        .select(`*, messages(*)`)
        .eq('user_id', user.id)
        .single();

      if (data) {
        if (data.draft_state && !mockStore.sessionStates.has(data.id)) {
          mockStore.sessionStates.set(data.id, data.draft_state);
        }
        const sortedMessages = (data.messages || []).sort(
          (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        return {
          ...data,
          user,
          messages: sortedMessages
        };
      }

      const newConv: Conversation = {
        id: crypto.randomUUID(),
        user_id: user.id,
        channel: 'WHATSAPP',
        is_ai_active: true,
        last_message_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        user,
        messages: []
      };
      await client.from('conversations').insert({
        id: newConv.id,
        user_id: newConv.user_id,
        channel: newConv.channel,
        is_ai_active: newConv.is_ai_active,
        last_message_at: newConv.last_message_at,
        created_at: newConv.created_at
      });
      return newConv;
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
    const newMsg: Message = {
      id: msgId,
      conversation_id: conversationId,
      sender,
      content,
      raw_payload: metadata,
      created_at: new Date().toISOString()
    };

    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      await client.from('messages').insert({
        id: msgId,
        conversation_id: conversationId,
        sender,
        content,
        raw_payload: metadata || null,
        created_at: newMsg.created_at
      });

      await client
        .from('conversations')
        .update({ last_message_at: newMsg.created_at })
        .eq('id', conversationId);

      return newMsg;
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
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      try {
        await client
          .from('conversations')
          .update({ is_ai_active: isAiActive })
          .eq('id', conversationId);
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
