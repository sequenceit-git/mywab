import {
  UserProfile,
  FAQ,
  Order,
  Worker,
  OrderAssignment,
  Conversation,
  ConversationSessionState,
  Message,
  Payment
} from '@/types';
import {
  DEFAULT_DS_DUKAN_FAQS,
  DEFAULT_DEMO_USERS,
  DEFAULT_DEMO_CONVERSATIONS,
  DEFAULT_DEMO_MESSAGES
} from './seeds';

// Clean in-memory fallback store used when MongoDB is not configured or in unit testing
export class MockDatabaseStore {
  users: Map<string, UserProfile> = new Map();
  faqs: Map<string, FAQ> = new Map();
  orders: Map<string, Order> = new Map();
  workers: Map<string, Worker> = new Map();
  assignments: Map<string, OrderAssignment> = new Map();
  conversations: Map<string, Conversation> = new Map();
  messages: Map<string, Message> = new Map();
  payments: Map<string, Payment> = new Map();
  sessionStates: Map<string, ConversationSessionState> = new Map();

  constructor() {
    // Seed default FAQs
    DEFAULT_DS_DUKAN_FAQS.forEach(f => this.faqs.set(f.id, f));

    // Seed default demo users
    DEFAULT_DEMO_USERS.forEach(u => this.users.set(u.id, u as UserProfile));

    // Seed default demo conversations & session states
    DEFAULT_DEMO_CONVERSATIONS.forEach(c => {
      const user = this.users.get(c.user_id);
      this.conversations.set(c.id, {
        id: c.id,
        user_id: c.user_id,
        channel: c.channel,
        is_ai_active: c.is_ai_active,
        last_message_at: c.last_message_at,
        created_at: c.created_at,
        user: user,
        draft_state: c.draft_state as ConversationSessionState,
        session_state: c.draft_state as ConversationSessionState
      });
      if (c.draft_state) {
        this.sessionStates.set(c.id, c.draft_state as ConversationSessionState);
      }
    });

    // Seed default demo messages
    DEFAULT_DEMO_MESSAGES.forEach(m => {
      this.messages.set(m.id, {
        id: m.id,
        conversation_id: m.conversation_id,
        sender: m.sender,
        content: m.content,
        raw_payload: (m as any).raw_payload || null,
        created_at: m.created_at
      });
    });
  }
}

// Global Singleton for in-memory store in dev
const globalForStore = global as unknown as { mockStore?: MockDatabaseStore };
export const mockStore = globalForStore.mockStore || new MockDatabaseStore();
if (process.env.NODE_ENV !== 'production') globalForStore.mockStore = mockStore;
