-- Migration: Definitive fix for handle_new_user_registration and profiles schema
-- Description: Ensures schema consistency and security for the user registration flow.

-- 1. Ensure profiles table has assigned_clients as uuid[]
-- If it's currently jsonb, we need to convert it or ensure it exists as uuid[]
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'assigned_clients' AND data_type = 'jsonb'
    ) THEN
        ALTER TABLE public.profiles ALTER COLUMN assigned_clients TYPE uuid[] USING ARRAY[]::uuid[];
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'assigned_clients'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN assigned_clients uuid[];
    END IF;
END $$;

-- 2. Fix handle_new_user_registration function
CREATE OR REPLACE FUNCTION public.handle_new_user_registration()
RETURNS TRIGGER AS $$
DECLARE
    new_client_id UUID;
    company_name TEXT;
BEGIN
    -- Get the company name from metadata, or fallback to email username
    company_name := new.raw_user_meta_data->>'company_name';
    IF company_name IS NULL OR company_name = '' THEN
        -- Fallback to old key or email username
        company_name := new.raw_user_meta_data->>'full_name';
        IF company_name IS NULL OR company_name = '' THEN
            company_name := split_part(new.email, '@', 1);
        END IF;
    END IF;

    -- Generate a new UUID for the client
    new_client_id := gen_random_uuid();

    -- 1. Create a new Client record for this user
    INSERT INTO public.clients (id, name, email)
    VALUES (new_client_id, company_name, new.email);

    -- 2. Create a User Profile linked to the new Client
    -- We use ARRAY[new_client_id] for uuid[] column
    INSERT INTO public.profiles (id, email, username, role, assigned_clients)
    VALUES (
        new.id, 
        new.email, 
        NULL, 
        'CLIENT', 
        ARRAY[new_client_id]
    );

    -- 3. Create default warehouses (Galpón is required for movements)
    -- Using snake_case for DB columns (client_id)
    INSERT INTO public.warehouses (id, client_id, name, created_at, updated_at)
    VALUES 
        (gen_random_uuid(), new_client_id, 'Galpón', now(), now()),
        (gen_random_uuid(), new_client_id, 'Acopio de Granos', now(), now());

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Re-create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_registration();
