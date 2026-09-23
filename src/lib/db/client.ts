import { connectToDatabase, isMongoConnected } from './mongodb';
import { env } from '../config/env';

export const isDbConfigured = (): boolean => {
  return env.mongodb.isConfigured;
};

export const getDbClient = async () => {
  if (!isDbConfigured()) return null;
  return await connectToDatabase();
};

export { connectToDatabase, isMongoConnected };
