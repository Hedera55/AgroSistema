-- Add status and observed yield to lots
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'EMPTY';
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS observed_yield NUMERIC DEFAULT 0;

-- Update existing lots to have the default status if null
UPDATE public.lots SET status = 'EMPTY' WHERE status IS NULL;
UPDATE public.lots SET observed_yield = 0 WHERE observed_yield IS NULL;
