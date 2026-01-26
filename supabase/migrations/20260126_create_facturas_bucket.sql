-- Create storage bucket for facturas
INSERT INTO storage.buckets (id, name, public)
VALUES ('facturas', 'facturas', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload facturas"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'facturas' );

-- Policy to allow public access to view files (since it's a public bucket)
CREATE POLICY "Public access to view facturas"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'facturas' );

-- Policy to allow users to update their own files (optional, but good for re-upload)
CREATE POLICY "Users can update their own facturas"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'facturas' )
WITH CHECK ( bucket_id = 'facturas' );
