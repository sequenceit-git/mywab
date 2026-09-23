import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUserDocument extends Document {
  id: string;
  phone_number: string;
  name: string | null;
  address_profile?: any;
  customer_profile?: any;
  language_pref: 'bn' | 'en';
  status_tag: 'VIP' | 'REGULAR' | 'FLAGGED';
  created_at: string;
  updated_at?: string;
}

const UserSchema = new Schema<IUserDocument>(
  {
    id: { type: String, required: true, index: true },
    phone_number: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: null },
    address_profile: { type: Schema.Types.Mixed, default: {} },
    customer_profile: { type: Schema.Types.Mixed, default: {} },
    language_pref: { type: String, default: 'bn' },
    status_tag: { type: String, default: 'REGULAR', index: true },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

export const UserModel: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema);
