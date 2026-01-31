-- Create a function that runs when a new user signs up
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
    -- username is set to NULL to fallback to email in the UI
    INSERT INTO public.profiles (id, email, username, role, assigned_clients)
    VALUES (
        new.id, 
        new.email, 
        NULL, 
        'CLIENT', 
        jsonb_build_array(new_client_id)
    );

    -- 3. Create default warehouses
    INSERT INTO public.warehouses (id, client_id, name, created_at, updated_at)
    VALUES 
        (gen_random_uuid(), new_client_id, 'Galpón', now(), now()),
        (gen_random_uuid(), new_client_id, 'Acopio de Granos', now(), now());

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the trigger to be sure
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_registration();
