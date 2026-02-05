-- Enable RLS on stock table
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;

-- Drop existing policy to avoid conflicts
DROP POLICY IF EXISTS "Users can view stock of assigned clients" ON stock;
DROP POLICY IF EXISTS "Users can manage stock of assigned clients" ON stock;

-- Re-create policy for VIEWING (SELECT)
CREATE POLICY "Users can view stock of assigned clients" ON stock
  FOR SELECT USING ( public.has_client_access(client_id) );

-- Create policy for MANAGING (INSERT, UPDATE, DELETE)
-- This policy uses the same check: if you have access to the client, you can manage their stock.
CREATE POLICY "Users can manage stock of assigned clients" ON stock
  FOR ALL USING ( public.has_client_access(client_id) );
