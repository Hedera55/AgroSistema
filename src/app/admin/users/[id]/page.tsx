'use client';

import { useAuth } from '@/hooks/useAuth';
import ProfileForm from '@/components/ProfileForm';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminUserProfilePage() {
    const { isMaster, loading } = useAuth();
    const params = useParams();
    const router = useRouter();
    const userId = params.id as string;

    useEffect(() => {
        if (!loading && !isMaster) {
            router.push('/');
        }
    }, [isMaster, loading, router]);

    if (loading) return <div className="p-8 text-center text-slate-500">Cargando...</div>;
    if (!isMaster) return null;

    return <ProfileForm targetUserId={userId} isAdminView={true} />;
}
