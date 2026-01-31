-- Robust fix for products_type_check and products_unit_check
-- This script identifies existing constraints by column rather than name to ensure they are correctly replaced.

DO $$ 
DECLARE 
    cname TEXT;
BEGIN
    -- 1. Drop ALL check constraints on the 'type' column
    FOR cname IN 
        SELECT conname 
        FROM pg_constraint 
        JOIN pg_class ON pg_class.oid = pg_constraint.conrelid 
        JOIN pg_attribute ON pg_attribute.attrelid = pg_class.oid AND pg_attribute.attnum = ANY(pg_constraint.conkey)
        WHERE pg_class.relname = 'products' 
          AND pg_attribute.attname = 'type' 
          AND pg_constraint.contype = 'c'
    LOOP
        EXECUTE 'ALTER TABLE products DROP CONSTRAINT ' || quote_ident(cname);
    END LOOP;

    -- 2. Add the comprehensive type check
    ALTER TABLE products ADD CONSTRAINT products_type_check 
    CHECK (type IN ('HERBICIDE', 'FUNGICIDE', 'INSECTICIDE', 'FERTILIZER', 'SEED', 'OTHER', 'ADJUVANT', 'INOCULANT', 'REGULATOR', 'SERVICE'));

    -- 3. Drop ALL check constraints on the 'unit' column
    FOR cname IN 
        SELECT conname 
        FROM pg_constraint 
        JOIN pg_class ON pg_class.oid = pg_constraint.conrelid 
        JOIN pg_attribute ON pg_attribute.attrelid = pg_class.oid AND pg_attribute.attnum = ANY(pg_constraint.conkey)
        WHERE pg_class.relname = 'products' 
          AND pg_attribute.attname = 'unit' 
          AND pg_constraint.contype = 'c'
    LOOP
        EXECUTE 'ALTER TABLE products DROP CONSTRAINT ' || quote_ident(cname);
    END LOOP;

    -- 4. Add the comprehensive unit check (includes UN, UNIT, KG, kg, etc.)
    ALTER TABLE products ADD CONSTRAINT products_unit_check 
    CHECK (unit IN ('L', 'KG', 'kg', 'UN', 'UNIT', 'M3', 'HA', 'U'));

END $$;
