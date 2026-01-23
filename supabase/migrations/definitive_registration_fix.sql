-- 1. Ensure clients table has all required columns
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Create the registration function with correct types (uuid[])
CREATE OR REPLACE FUNCTION public.handle_new_user_registration()
RETURNS TRIGGER AS $$
DECLARE
    new_client_id UUID;
    full_name TEXT;
BEGIN
    -- Get the full name from metadata, or fallback to email username
    full_name := new.raw_user_meta_data->>'full_name';
    IF full_name IS NULL OR full_name = '' THEN
        full_name := split_part(new.email, '@', 1);
    END IF;

    -- Generate a new UUID using the schema's preferred extension (uuid-ossp)
    new_client_id := uuid_generate_v4();

    -- 1. Create a new Client record for this user
    INSERT INTO public.clients (id, name, email)
    VALUES (new_client_id, full_name, new.email);

    -- 2. Create a User Profile linked to the new Client
    -- We use ARRAY[uuid] to match the uuid[] column type
    INSERT INTO public.profiles (id, email, username, role, assigned_clients)
    VALUES (
        new.id, 
        new.email, 
        full_name, 
        'CLIENT', 
        ARRAY[new_client_id]
    );

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure the trigger is active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_registration();
