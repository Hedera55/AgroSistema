'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { supabase } from '@/lib/supabase';
import { UserProfile, UserRole } from '@/types';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
    role: UserRole | null;
    isAdmin: boolean;
    isMaster: boolean;
    isActive: boolean;
    assignedId: string | null;
    displayName: string;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    loading: true,
    role: null,
    isAdmin: false,
    isMaster: false,
    isActive: false,
    assignedId: null,
    displayName: '',
    refreshProfile: async () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshProfile = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (data) {
                setProfile(data as UserProfile);
            }
        } catch (err) {
            console.error('Error refreshing profile:', err);
        }
    };

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            handleSession(session);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            handleSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleSession = async (session: Session | null) => {
        if (!session) {
            setUser(null);
            setProfile(null);
            setLoading(false);
            return;
        }

        setUser(session.user);

        // Fetch custom profile data (role, assignments) from the 'profiles' table
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (data) {
                setProfile(data as UserProfile);
            }
        } catch (err) {
            console.error('Error fetching profile:', err);
        } finally {
            setLoading(false);
        }
    };

    const value = {
        user,
        profile,
        loading,
        role: profile?.role || null,
        isAdmin: profile?.role === 'ADMIN' || profile?.role === 'MASTER_ADMIN',
        isMaster: profile?.role === 'MASTER_ADMIN',
        isActive: !!user,
        assignedId: profile?.assigned_clients?.[0] || null,
        displayName: profile?.username || profile?.email || user?.email || 'Sistema',
        refreshProfile,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
