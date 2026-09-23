import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWorkerDocument extends Document {
  id: string;
  telegram_user_id: number;
  telegram_username?: string | null;
  full_name: string;
  phone_number?: string | null;
  role: 'WORKER' | 'SUPERVISOR' | 'ADMIN';
  is_active: boolean;
  created_at: string;
}

const WorkerSchema = new Schema<IWorkerDocument>(
  {
    id: { type: String, required: true, index: true },
    telegram_user_id: { type: Number, required: true, unique: true, index: true },
    telegram_username: { type: String, default: null },
    full_name: { type: String, required: true },
    phone_number: { type: String, default: null },
    role: { type: String, default: 'WORKER' },
    is_active: { type: Boolean, default: true },
    created_at: { type: String, default: () => new Date().toISOString() },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

export const WorkerModel: Model<IWorkerDocument> =
  mongoose.models.Worker || mongoose.model<IWorkerDocument>('Worker', WorkerSchema);
