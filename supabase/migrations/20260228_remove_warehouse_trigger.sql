-- Update the registration function to REMOVE automatic warehouse creation.
-- This logic is now handled exclusively by the client-side Layout.tsx initialization 
-- to prevent duplicate "Galpón" and "Acopio de Granos" records during sync.

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
    INSERT INTO public.profiles (id, email, username, role, assigned_clients)
    VALUES (
        new.id, 
        new.email, 
        NULL, 
        'CLIENT', 
        jsonb_build_array(new_client_id)
    );

    -- [REMOVED] Step 3: Create default warehouses
    -- (No longer inserting into public.warehouses here)

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
