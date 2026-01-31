-- Migration to allow full user deletion from auth.users via a SECURITY DEFINER function.
-- This ensures that deleting a profile also removes the login credentials, allowing re-registration.

CREATE OR REPLACE FUNCTION delete_user_entirely(user_id_to_delete UUID)
RETURNS void AS $$
DECLARE
    is_master_admin BOOLEAN;
BEGIN
    -- 1. Security Check: Only MASTER_ADMIN can delete users
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'MASTER_ADMIN'
    ) INTO is_master_admin;

    IF NOT is_master_admin THEN
        RAISE EXCEPTION 'Solo un MASTER_ADMIN puede eliminar usuarios permanentemente.';
    END IF;

    -- 2. Safety Check: Cannot delete yourself!
    IF user_id_to_delete = auth.uid() THEN
        RAISE EXCEPTION 'No puedes eliminarte a ti mismo del sistema.';
    END IF;

    -- 3. Safety Check: If the user being deleted is a MASTER_ADMIN, 
    -- ensure there's at least one other MASTER_ADMIN remaining.
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id_to_delete AND role = 'MASTER_ADMIN') THEN
        IF (SELECT count(*) FROM public.profiles WHERE role = 'MASTER_ADMIN') <= 1 THEN
            RAISE EXCEPTION 'No se puede eliminar al último MASTER_ADMIN.';
        END IF;
    END IF;

    -- 4. Perform Deletion from auth.users
    -- This will automatically cascade to public.profiles because of the FK constraint.
    DELETE FROM auth.users WHERE id = user_id_to_delete;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
