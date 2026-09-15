import {
  UserProfile,
  Product,
  FAQ,
  AIPolicy,
  Order,
  Worker,
  OrderAssignment,
  Conversation,
  ConversationSessionState,
  Message,
  Payment
} from '@/types';
import {
  DEFAULT_DS_DUKAN_PRODUCTS,
  DEFAULT_DS_DUKAN_FAQS,
  DEFAULT_AI_POLICIES
} from './seeds';

// Clean in-memory fallback store used when Supabase is not configured or in unit testing
export class MockDatabaseStore {
  users: Map<string, UserProfile> = new Map();
  products: Map<string, Product> = new Map();
  faqs: Map<string, FAQ> = new Map();
  aiPolicies: Map<string, AIPolicy> = new Map();
  orders: Map<string, Order> = new Map();
  workers: Map<string, Worker> = new Map();
  assignments: Map<string, OrderAssignment> = new Map();
  conversations: Map<string, Conversation> = new Map();
  messages: Map<string, Message> = new Map();
  payments: Map<string, Payment> = new Map();
  sessionStates: Map<string, ConversationSessionState> = new Map();

  constructor() {
    // Seed default products, FAQs, and AI policies
    DEFAULT_DS_DUKAN_PRODUCTS.forEach(p => this.products.set(p.id, p));
    DEFAULT_DS_DUKAN_FAQS.forEach(f => this.faqs.set(f.id, f));
    DEFAULT_AI_POLICIES.forEach(pol => this.aiPolicies.set(pol.id, pol));
  }
}

// Global Singleton for in-memory store in dev
const globalForStore = global as unknown as { mockStore?: MockDatabaseStore };
export const mockStore = globalForStore.mockStore || new MockDatabaseStore();
if (process.env.NODE_ENV !== 'production') globalForStore.mockStore = mockStore;
