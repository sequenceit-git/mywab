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

export interface UserProfile {
  id: string;
  phone_number: string;
  name: string | null;
  address_profile: {
    street?: string;
    city?: string;
    area?: string;
    postal_code?: string;
    full_address?: string;
  };
  language_pref: 'bn' | 'en';
  status_tag: 'VIP' | 'REGULAR' | 'FLAGGED';
  created_at: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  sku: string;
  name_en: string;
  name_bn: string;
  description_en: string | null;
  description_bn: string | null;
  price: number;
  stock_qty: number;
  category: string;
  is_active: boolean;
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

export interface AIPolicy {
  id: string;
  type: 'DO' | 'DONT';
  title: string;
  rule_bn: string;
  rule_en: string;
  category: string;
  is_active: boolean;
  priority: number;
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
  screenshot_url?: string | null;
  created_at: string;
  verified_at?: string | null;
}

export type ConversationStep = 
  | 'IDLE' 
  | 'COLLECTING_DETAILS' 
  | 'AWAITING_PAYMENT' 
  | 'AWAITING_CONFIRMATION' 
  | 'PARALLEL_CONFIRMATION' 
  | 'ORDER_PLACED';

export interface DraftOrderItem {
  skuOrName: string;
  quantity: number;
  unitPrice?: number;
  productName?: string;
}

export interface ConversationDraftOrder {
  items: DraftOrderItem[];
  customerName?: string;
  deliveryAddress?: string;
  customerPhone?: string;
  playerUid?: string;
  paymentMethod?: string;
  trxId?: string;
  customerNotes?: string;
  totalAmount?: number;
}

export interface ConversationSessionState {
  step: ConversationStep;
  draftOrder: ConversationDraftOrder;
  parallelDrafts?: ConversationDraftOrder[];
  lastOrderId?: string;
  lastCreatedOrders?: string[];
  lastInteractionTimestamp: number;
}

export interface Conversation {
  id: string;
  user_id: string;
  channel: 'WHATSAPP';
  is_ai_active: boolean;
  last_message_at: string;
  created_at: string;
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
