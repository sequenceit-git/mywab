import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMessageDocument extends Document {
  id: string;
  conversation_id: string;
  sender: 'USER' | 'BOT' | 'AGENT';
  content: string;
  metadata?: any;
  created_at: string;
}

const MessageSchema = new Schema<IMessageDocument>(
  {
    id: { type: String, required: true, index: true },
    conversation_id: { type: String, required: true, index: true },
    sender: { type: String, required: true, enum: ['USER', 'BOT', 'AGENT'] },
    content: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    created_at: { type: String, default: () => new Date().toISOString(), index: true },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

MessageSchema.index({ conversation_id: 1, created_at: 1 });

export const MessageModel: Model<IMessageDocument> =
  mongoose.models.Message || mongoose.model<IMessageDocument>('Message', MessageSchema);
