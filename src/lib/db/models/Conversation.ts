import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IConversationDocument extends Document {
  id: string;
  phone: string;
  user_id?: string | null;
  current_mode?: string;
  draft_state?: any;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
}

const ConversationSchema = new Schema<IConversationDocument>(
  {
    id: { type: String, required: true, index: true },
    phone: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, default: null, index: true },
    current_mode: { type: String, default: 'BOT' },
    draft_state: { type: Schema.Types.Mixed, default: {} },
    last_message_at: { type: String, default: () => new Date().toISOString() },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

export const ConversationModel: Model<IConversationDocument> =
  mongoose.models.Conversation || mongoose.model<IConversationDocument>('Conversation', ConversationSchema);
