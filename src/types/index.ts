export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PENDING_CLAIM'
  | 'CLAIMED'
  | 'PROCESSING'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentStatus = 'UNPAID' | 'VERIFYING' | 'VERIFIED' | 'FAILED';

export type PaymentMethod = 'COD' | 'BKASH' | 'NAGAD' | 'ROCKET' | 'CARD';

export type UserRole = 'CUSTOMER' | 'WORKER' | 'SUPERVISOR' | 'ADMIN';

export interface CustomerMemoryProfile {
  saved_uids: string[];
  last_used_uid?: string;
  preferred_payment?: string;
  total_completed_orders: number;
  vip_status?: boolean;
  notes?: string;
}

export interface UserProfile {
  id: string;
  phone_number: string;
  name: string | null;
  address_profile?: {
    street?: string;
    city?: string;
    area?: string;
    postal_code?: string;
    full_address?: string;
  };
  customer_profile?: CustomerMemoryProfile;
  language_pref: 'bn' | 'en';
  status_tag: 'VIP' | 'REGULAR' | 'FLAGGED';
  created_at: string;
  updated_at?: string;
}

export interface UserLeaderboardEntry {
  id: string;
  phone_number: string;
  name: string | null;
  status_tag: 'VIP' | 'REGULAR' | 'FLAGGED';
  total_spent: number;
  total_orders: number;
  delivered_orders: number;
  last_order_at: string | null;
  latest_uid: string | null;
  saved_uids: string[];
  favorite_game?: string;
  rank: number;
  created_at: string;
}

export interface FAQ {
  id: string;
  question_en: string;
  question_bn: string;
  answer_en: string;
  answer_bn: string;
  category: string;
  is_active: boolean;
  created_at: string;
}


export interface OrderItem {
  id?: string;
  order_id?: string;
  product_id?: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export interface Order {
  id: string;
  order_id: string; // e.g. WAP-20260914-1001
  user_id: string;
  total_amount: number;
  status: OrderStatus;
  delivery_address: {
    name?: string;
    phone?: string;
    address: string;
    city?: string;
    area?: string;
    notes?: string;
  };
  delivery_phone: string;
  customer_notes?: string;
  player_uid?: string;
  trx_id?: string;
  payment_method?: PaymentMethod | string;
  invoice_id?: string;
  payment_url?: string;
  telegram_message_id?: number | null;
  created_at: string;
  updated_at?: string;
  
  // Joined relational data
  customer?: UserProfile;
  items?: OrderItem[];
  payments?: Payment[];
  assignments?: OrderAssignment[];
  current_worker?: Worker | null;
}

export interface Worker {
  id: string;
  telegram_user_id: number;
  telegram_username: string | null;
  full_name: string;
  phone_number?: string | null;
  role: 'WORKER' | 'SUPERVISOR' | 'ADMIN';
  is_active: boolean;
  created_at: string;
  total_completed_orders?: number;
  active_orders?: number;
}

export interface OrderAssignment {
  id: string;
  order_id: string;
  worker_id: string;
  status: 'CLAIMED' | 'PROCESSING' | 'DELIVERED' | 'RELEASED';
  claimed_at: string;
  completed_at?: string | null;
  notes?: string | null;
  worker?: Worker;
}

export interface Payment {
  id: string;
  order_id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transaction_id: string | null;
  invoice_id?: string | null;
  screenshot_url?: string | null;
  created_at: string;
  verified_at?: string | null;
}

export type ConversationStep =
  | 'IDLE'              // No active flow - show welcome menu on next message
  | 'SELECTING_GAME'    // Game list shown, waiting for game choice
  | 'SELECTING_PACKAGE' // Game chosen, price list shown, waiting for package tap
  | 'COLLECTING_UID'    // Package chosen, waiting for UID / account info text
  | 'AWAITING_PAYMENT'  // UID saved, payment info shown, waiting for TrxID text
  | 'AWAITING_VERIFICATION_CODE' // Worker requested email verification code, waiting for customer to send it (PUBG KR / eFootball)
  | 'ORDER_PLACED';     // Order created, confirmation sent

export interface DraftOrderItem {
  skuOrName: string;
  quantity: number;
  unitPrice?: number;
  productName?: string;
}

export interface ConversationDraftOrder {
  items: DraftOrderItem[];
  customerName?: string;
  customerPhone?: string;
  playerUid?: string;
  paymentMethod?: string;
  trxId?: string;
  customerNotes?: string;
  totalAmount?: number;
  // ZiniPay Payment info
  invoiceId?: string;
  paymentUrl?: string;
  pendingOrderId?: string;
  // State-bot specific
  selectedGame?: string;       // e.g. 'pubg_uid', 'ff', 'efb_android'
  selectedGameLabel?: string;  // e.g. 'PUBG Mobile UID Top-Up'
  packagePage?: number;        // Current package pagination page (0-indexed)
}

export interface ConversationSessionState {
  step: ConversationStep;
  draftOrder: ConversationDraftOrder;
  lastOrderId?: string;
  lastInteractionTimestamp: number;
}

export interface Conversation {
  id: string;
  user_id: string;
  channel: 'WHATSAPP';
  is_ai_active: boolean;
  last_message_at: string;
  created_at: string;
  summary?: string;
  draft_state?: ConversationSessionState;
  user?: UserProfile;
  messages?: Message[];
  session_state?: ConversationSessionState;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender: 'CUSTOMER' | 'BOT' | 'ADMIN';
  content: string;
  media_url?: string | null;
  raw_payload?: Record<string, unknown> | null;
  created_at: string;
}

// WhatsApp Webhook Payload Types
export interface WhatsAppIncomingMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'interactive' | 'location';
  text?: {
    body: string;
  };
}

// Telegram Callback Types
export interface TelegramClaimCallback {
  action: 'claim' | 'status_processing' | 'status_delivered' | 'release';
  order_id: string;
}

// Game Packages & Dynamic Catalog Types
export interface GamePackageItem {
  id: string;
  category_id: string;
  name: string;
  amount: string;
  price: number;
  base_price: number;
  profit?: number;
  margin_percent?: number;
  description?: string;
  is_active: boolean;
  sort_order: number;
  updated_at?: string;
  created_at?: string;
}

export interface GameCategoryItem {
  id: string;
  code: string;
  title: string;
  fullName: string;
  emoji: string;
  requiresUid: boolean;
  inputPrompt: string;
  inputLabel: string;
  packages: GamePackageItem[];
}

