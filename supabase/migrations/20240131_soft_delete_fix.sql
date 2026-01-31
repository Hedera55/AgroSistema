-- Migration to add soft-delete columns to orders and inventory_movements
-- This allows for consistent sync across devices when items are "deleted"

-- 1. Update orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_by TEXT;

-- 2. Update inventory_movements table
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT false;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS deleted_by TEXT;

-- 3. Create indexes for performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_orders_deleted ON orders(deleted) WHERE deleted = true;
CREATE INDEX IF NOT EXISTS idx_movements_deleted ON inventory_movements(deleted) WHERE deleted = true;
