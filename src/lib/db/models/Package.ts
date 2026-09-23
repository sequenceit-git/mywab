import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPackageDocument extends Document {
  id: string;
  category_id: string;
  name: string;
  amount: string;
  price: number;
  base_price: number;
  profit: number;
  margin_percent: number;
  description?: string;
  is_active: boolean;
  sort_order: number;
  updated_at: string;
}

const PackageSchema = new Schema<IPackageDocument>(
  {
    id: { type: String, required: true, unique: true, index: true },
    category_id: { type: String, required: true, index: true },
    name: { type: String, required: true },
    amount: { type: String, required: true },
    price: { type: Number, required: true },
    base_price: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
    margin_percent: { type: Number, default: 0 },
    description: { type: String, default: '' },
    is_active: { type: Boolean, default: true },
    sort_order: { type: Number, default: 0 },
    updated_at: { type: String, default: () => new Date().toISOString() },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

export const PackageModel: Model<IPackageDocument> =
  mongoose.models.Package || mongoose.model<IPackageDocument>('Package', PackageSchema);
