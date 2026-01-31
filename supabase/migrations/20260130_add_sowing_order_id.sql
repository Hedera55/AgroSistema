-- Migration: Add sowing_order_id to orders table
-- Description: Supports 1:1 linking between sowing and harvest orders.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS sowing_order_id UUID REFERENCES orders(id);

-- Optional: Add index for performance
CREATE INDEX IF NOT EXISTS idx_orders_sowing_order_id ON orders(sowing_order_id);
