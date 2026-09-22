-- ==============================================================================
-- Supabase Storage Bucket for Order Media (QR Codes, Receipts, Proofs)
-- ==============================================================================

-- 1. Insert bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'order-media',
  'order-media',
  true,
  10485760, -- 10 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 2. Public Read Policy for order-media
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access for Order Media'
  ) THEN
    CREATE POLICY "Public Access for Order Media"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'order-media');
  END IF;
END $$;

-- 3. Service Role & Authenticated Full Access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Service Role Full Access for Order Media'
  ) THEN
    CREATE POLICY "Service Role Full Access for Order Media"
    ON storage.objects FOR ALL
    TO service_role
    USING (bucket_id = 'order-media')
    WITH CHECK (bucket_id = 'order-media');
  END IF;
END $$;
