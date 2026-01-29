-- Financial & Crop Features Migration

-- 1. Add price to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0;

-- 2. Add investors to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS investors JSONB DEFAULT '[]'::JSONB;

-- 3. Add crop species and yield to lots
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS crop_species TEXT;
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS yield NUMERIC DEFAULT 0;

-- Update existing records to have defaults (though DEFAULT clause handles it for new and existing rows in many pg versions)
UPDATE public.products SET price = 0 WHERE price IS NULL;
UPDATE public.clients SET investors = '[]'::JSONB WHERE investors IS NULL;
UPDATE public.lots SET yield = 0 WHERE yield IS NULL;
