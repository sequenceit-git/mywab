import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFaqDocument extends Document {
  id: string;
  question_en: string;
  question_bn: string;
  answer_en: string;
  answer_bn: string;
  category: string;
  is_active: boolean;
  created_at: string;
}

const FaqSchema = new Schema<IFaqDocument>(
  {
    id: { type: String, required: true, unique: true, index: true },
    question_en: { type: String, default: '' },
    question_bn: { type: String, default: '' },
    answer_en: { type: String, default: '' },
    answer_bn: { type: String, default: '' },
    category: { type: String, default: 'General' },
    is_active: { type: Boolean, default: true, index: true },
    created_at: { type: String, default: () => new Date().toISOString() },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

export const FaqModel: Model<IFaqDocument> =
  mongoose.models.Faq || mongoose.model<IFaqDocument>('Faq', FaqSchema);
