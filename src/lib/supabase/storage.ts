import { supabaseAdmin, isSupabaseConfigured } from './client';

export const ORDER_MEDIA_BUCKET = 'order-media';

export const storageService = {
  /**
   * Ensure bucket exists in Supabase Storage and is configured as public
   */
  async ensureBucket(): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabaseAdmin) return false;
    try {
      const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
      if (!error && buckets) {
        const exists = buckets.some(b => b.name === ORDER_MEDIA_BUCKET || b.id === ORDER_MEDIA_BUCKET);
        if (!exists) {
          console.log(`[Supabase Storage] Creating public bucket "${ORDER_MEDIA_BUCKET}"...`);
          const { error: createError } = await supabaseAdmin.storage.createBucket(ORDER_MEDIA_BUCKET, {
            public: true,
            fileSizeLimit: 10485760, // 10MB
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
          });
          if (createError) {
            console.warn('[Supabase Storage createBucket Warning]:', createError.message);
          }
        }
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[Supabase Storage ensureBucket Exception]:', err);
      return false;
    }
  },

  /**
   * Upload image buffer to Supabase Storage bucket and return direct public CDN URL
   */
  async uploadImage(
    buffer: Buffer | ArrayBuffer | Uint8Array,
    filename: string,
    folder: string = 'pubg-qr',
    mimeType: string = 'image/jpeg'
  ): Promise<{ success: boolean; publicUrl?: string; path?: string; error?: string }> {
    if (!isSupabaseConfigured() || !supabaseAdmin) {
      return { success: false, error: 'Supabase is not configured' };
    }

    try {
      await this.ensureBucket();

      const sanitizedName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${folder}/${Date.now()}_${sanitizedName}`;

      const { data, error } = await supabaseAdmin.storage
        .from(ORDER_MEDIA_BUCKET)
        .upload(filePath, buffer, {
          contentType: mimeType,
          upsert: true
        });

      if (error) {
        console.error('[Supabase Storage Upload Error]:', error.message);
        return { success: false, error: error.message };
      }

      const { data: urlData } = supabaseAdmin.storage
        .from(ORDER_MEDIA_BUCKET)
        .getPublicUrl(filePath);

      console.log(`[Supabase Storage] Successfully stored media: ${filePath} -> Public URL: ${urlData.publicUrl}`);
      return { success: true, publicUrl: urlData.publicUrl, path: filePath };
    } catch (err) {
      console.error('[Supabase Storage Upload Exception]:', err);
      return { success: false, error: String(err) };
    }
  }
};
