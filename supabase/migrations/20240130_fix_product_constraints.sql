-- Fix products_type_check to include 'OTHER' and ensure all expected types are allowed
-- This address the sync error: "new row for relation \"products\" violates check constraint \"products_type_check\""

DO $$ 
BEGIN
    -- Check if the constraint exists and drop it to recreate with the correct values
    IF EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE table_name = 'products' AND constraint_name = 'products_type_check') THEN
        ALTER TABLE products DROP CONSTRAINT products_type_check;
    END IF;

    -- Add the constraint back with all possible types
    ALTER TABLE products ADD CONSTRAINT products_type_check 
    CHECK (type IN ('HERBICIDE', 'FUNGICIDE', 'INSECTICIDE', 'FERTILIZER', 'SEED', 'OTHER', 'ADJUVANT', 'INOCULANT', 'REGULATOR'));

    -- Also check the unit constraint just in case it's restrictive
    IF EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE table_name = 'products' AND constraint_name = 'products_unit_check') THEN
        ALTER TABLE products DROP CONSTRAINT products_unit_check;
    END IF;

    ALTER TABLE products ADD CONSTRAINT products_unit_check 
    CHECK (unit IN ('L', 'KG', 'kg', 'UN', 'UNIT', 'M3', 'HA'));

END $$;
