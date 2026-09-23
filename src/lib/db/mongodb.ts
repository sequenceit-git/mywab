import mongoose from 'mongoose';
import { env } from '../config/env';

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } | undefined;
}

let cached = global.mongooseCache;

if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

export async function connectToDatabase(): Promise<typeof mongoose | null> {
  const uri = env.mongodb.uri;
  if (!uri) {
    console.warn('[MongoDB] MONGODB_URI is not defined in environment.');
    return null;
  }

  if (cached?.conn && cached.conn.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached?.promise) {
    const opts = {
      bufferCommands: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    cached!.promise = mongoose.connect(uri, opts).then((m) => {
      console.log('[MongoDB] Connected successfully to MongoDB Atlas.');
      return m;
    }).catch((err) => {
      console.error('[MongoDB] Connection error:', err);
      cached!.promise = null;
      throw err;
    });
  }

  try {
    cached!.conn = await cached!.promise;
  } catch (e) {
    cached!.promise = null;
    return null;
  }

  return cached!.conn;
}

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
