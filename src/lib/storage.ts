import fs from 'fs';
import path from 'path';
import { env } from './config/env';

export const storageService = {
  /**
   * Ensure uploads folder exists in public directory
   */
  async ensureBucket(): Promise<boolean> {
    try {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'pubg-qr');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      return true;
    } catch (err) {
      console.warn('[StorageService ensureBucket Warning]:', err);
      return false;
    }
  },

  /**
   * Upload image buffer to public/uploads folder and return direct URL
   */
  async uploadImage(
    buffer: Buffer | ArrayBuffer | Uint8Array,
    filename: string,
    folder: string = 'pubg-qr',
    _mimeType: string = 'image/jpeg'
  ): Promise<{ success: boolean; publicUrl?: string; path?: string; error?: string }> {
    try {
      await this.ensureBucket();

      const sanitizedName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniqueFilename = `${Date.now()}_${sanitizedName}`;
      const targetDir = path.join(process.cwd(), 'public', 'uploads', folder);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const filePath = path.join(targetDir, uniqueFilename);
      const nodeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as any);

      fs.writeFileSync(filePath, nodeBuffer);

      const publicUrl = `${env.app.url}/uploads/${folder}/${uniqueFilename}`;
      console.log(`[StorageService] Successfully stored media locally: ${filePath} -> Public URL: ${publicUrl}`);

      return {
        success: true,
        publicUrl,
        path: `uploads/${folder}/${uniqueFilename}`
      };
    } catch (err: any) {
      console.error('[StorageService Upload Exception]:', err);
      return { success: false, error: err.message || String(err) };
    }
  }
};
