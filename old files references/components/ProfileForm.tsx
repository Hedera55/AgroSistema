'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Link from 'next/link';
import { UserProfile } from '@/types';

interface ProfileFormProps {
    targetUserId?: string;
    isAdminView?: boolean;
}

export default function ProfileForm({ targetUserId, isAdminView = false }: ProfileFormProps) {
    const { user: currentUser, profile: currentProfile, refreshProfile, loading: authLoading } = useAuth();
    const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
    const [targetEmail, setTargetEmail] = useState<string>('');
    const [username, setUsername] = useState('');
    const [cuit, setCuit] = useState('');
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const effectiveUserId = targetUserId || currentUser?.id;

    useEffect(() => {
        if (!effectiveUserId) return;

        if (!targetUserId && currentProfile) {
            setTargetProfile(currentProfile);
            setTargetEmail(currentUser?.email || '');
            setUsername(currentProfile.username || '');
            setLoading(false);
        } else {
            fetchTargetProfile();
        }
    }, [targetUserId, effectiveUserId, currentProfile]);

    const fetchTargetProfile = async () => {
        if (!effectiveUserId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', effectiveUserId)
                .single();

            if (error) throw error;
            if (data) {
                setTargetProfile(data as UserProfile);
                setUsername(data.username || '');
                setTargetEmail(data.email || ''); // Assuming email is in profiles or fetched separately
                setCuit(data.cuit || '');
            }
        } catch (err) {
            console.error('Error fetching target profile:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!effectiveUserId) return;

        setIsSaving(true);
        setMessage(null);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    username: username.trim() || null,
                    cuit: cuit.trim() || null
                })
                .eq('id', effectiveUserId);

            if (error) throw error;

            if (!targetUserId) {
                await refreshProfile();
            }
            setMessage({ type: 'success', text: 'Perfil actualizado correctamente.' });
        } catch (err: any) {
            console.error('Error updating profile:', err);
            setMessage({ type: 'error', text: 'Error al actualizar el perfil: ' + (err.message || 'Error desconocido') });
        } finally {
            setIsSaving(false);
        }
    };

    if (authLoading || (loading && effectiveUserId)) return <div className="p-8 text-center text-slate-500">Cargando perfil...</div>;
    if (!effectiveUserId) return <div className="p-8 text-center text-red-500">Usuario no encontrado</div>;

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
            <div>
                <Link href={isAdminView ? "/admin/users" : "/"} className="text-sm text-slate-500 hover:text-emerald-600 mb-2 inline-block">
                    {isAdminView ? '← Volver a Usuarios' : '← Volver al Inicio'}
                </Link>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                    {isAdminView ? `Perfil de ${targetEmail}` : 'Mi Perfil'}
                </h1>
                <p className="text-slate-500 mt-1">
                    {isAdminView ? 'Gestione la información de este usuario.' : 'Personalice cómo se muestra su nombre en el sistema.'}
                </p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                <div className="p-8 border-b border-slate-50 bg-slate-50/30">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-full bg-emerald-600 flex items-center justify-center text-2xl font-black text-white shadow-lg shadow-emerald-200">
                            {(username || targetEmail || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">{username || targetEmail}</h2>
                            <p className="text-slate-500 text-sm">{username ? targetEmail : ''}</p>
                            <span className="inline-block mt-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                {targetProfile?.role}
                            </span>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSave} className="p-8 space-y-6">
                    <div className="space-y-4">
                        <Input
                            label="Nombre de Usuario (Username)"
                            placeholder="ej. JuanPerez"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />

                        {targetProfile?.role === 'CONTRATISTA' && (
                            <Input
                                label="CUIT"
                                placeholder="20-12345678-9"
                                value={cuit}
                                onChange={(e) => setCuit(e.target.value)}
                            />
                        )}
                        <p className="text-xs text-slate-400">
                            Este nombre aparecerá en los historiales de stock, órdenes y modificaciones de campos.
                        </p>
                    </div>

                    {message && (
                        <div className={`p-4 rounded-xl text-sm border animate-fadeIn ${message.type === 'success'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-red-50 text-red-600 border-red-100'
                            }`}>
                            {message.text}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <Button
                            type="submit"
                            isLoading={isSaving}
                            className="px-8"
                        >
                            Guardar Cambios
                        </Button>
                    </div>
                </form>
            </div>

            {!isAdminView && (
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-800 mb-2">Seguridad</h3>
                    <p className="text-xs text-slate-500 mb-4">
                        Su cuenta está protegida por Supabase Auth. Para cambiar su contraseña, contacte al Master Admin o utilice el flujo de recuperación de contraseña.
                    </p>
                </div>
            )}
        </div>
    );
}
