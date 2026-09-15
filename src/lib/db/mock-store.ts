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
  DEFAULT_DS_DUKAN_FAQS
} from './seeds';

// Clean in-memory fallback store used when Supabase is not configured or in unit testing
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
  }
}

// Global Singleton for in-memory store in dev
const globalForStore = global as unknown as { mockStore?: MockDatabaseStore };
export const mockStore = globalForStore.mockStore || new MockDatabaseStore();
if (process.env.NODE_ENV !== 'production') globalForStore.mockStore = mockStore;
