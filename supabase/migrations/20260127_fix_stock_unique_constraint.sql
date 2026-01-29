-- Fix unique constraint for client_stock to support multi-warehouse
-- Previously, a client could only have one entry per product.
-- Now, a client can have one entry per product PER warehouse.

-- 1. Identify the name of the constraint (confirmed from error: "stock_client_id_product_id_key")
-- 2. Drop the old constraint
ALTER TABLE public.stock DROP CONSTRAINT IF EXISTS stock_client_id_product_id_key;

-- 3. Add the new constraint including warehouse_id
ALTER TABLE public.stock ADD CONSTRAINT stock_client_product_warehouse_key UNIQUE (client_id, product_id, warehouse_id);

-- Note: If you have existing data that violates this NEW constraint (e.g. two rows for same client/product/warehouse), 
-- you'll need to manually merge them before running this OR delete duplicates.
