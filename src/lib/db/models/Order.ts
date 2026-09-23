import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOrderItem {
  id?: string;
  product_id?: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export interface IPayment {
  id?: string;
  amount: number;
  method: string;
  status: string;
  transaction_id?: string | null;
  invoice_id?: string | null;
  screenshot_url?: string | null;
  created_at?: string;
}

export interface IWorkerSubdoc {
  id?: string;
  telegram_user_id: number;
  telegram_username?: string | null;
  full_name: string;
  phone_number?: string | null;
  role?: string;
}

export interface IOrderDocument extends Document {
  id: string; // compatibility with UUID
  order_id: string; // e.g. WAP-20260924-1001
  user_id: string;
  total_amount: number;
  status: string;
  delivery_address: any;
  delivery_phone: string;
  customer_notes?: string | null;
  player_uid?: string | null;
  trx_id?: string | null;
  payment_method?: string | null;
  invoice_id?: string | null;
  payment_url?: string | null;
  telegram_message_id?: number | null;
  items: IOrderItem[];
  payments: IPayment[];
  current_worker?: IWorkerSubdoc | null;
  created_at: string;
  updated_at: string;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    id: { type: String },
    product_id: { type: String, default: null },
    product_name: { type: String, required: true },
    unit_price: { type: Number, required: true },
    quantity: { type: Number, required: true, default: 1 },
    subtotal: { type: Number, required: true },
  },
  { _id: false }
);

const PaymentSubdocSchema = new Schema<IPayment>(
  {
    id: { type: String },
    amount: { type: Number, required: true },
    method: { type: String, default: 'BKASH' },
    status: { type: String, default: 'VERIFYING' },
    transaction_id: { type: String, default: null },
    invoice_id: { type: String, default: null },
    screenshot_url: { type: String, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false }
);

const WorkerSubdocSchema = new Schema<IWorkerSubdoc>(
  {
    id: { type: String },
    telegram_user_id: { type: Number, required: true },
    telegram_username: { type: String, default: null },
    full_name: { type: String, required: true },
    phone_number: { type: String, default: null },
    role: { type: String, default: 'WORKER' },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrderDocument>(
  {
    id: { type: String, required: true, index: true },
    order_id: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, required: true, index: true },
    total_amount: { type: Number, required: true },
    status: { type: String, required: true, index: true },
    delivery_address: { type: Schema.Types.Mixed, default: {} },
    delivery_phone: { type: String, required: true, index: true },
    customer_notes: { type: String, default: null },
    player_uid: { type: String, default: null, index: true },
    trx_id: { type: String, default: null, index: true },
    payment_method: { type: String, default: 'BKASH' },
    invoice_id: { type: String, default: null, index: true },
    payment_url: { type: String, default: null },
    telegram_message_id: { type: Number, default: null, index: true },
    items: { type: [OrderItemSchema], default: [] },
    payments: { type: [PaymentSubdocSchema], default: [] },
    current_worker: { type: WorkerSubdocSchema, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

OrderSchema.index({ status: 1, created_at: -1 });
OrderSchema.index({ status: 1, telegram_message_id: 1 });

export const OrderModel: Model<IOrderDocument> =
  mongoose.models.Order || mongoose.model<IOrderDocument>('Order', OrderSchema);
