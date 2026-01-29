'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Link from 'next/link';

export default function ProfilePage() {
    const { user, profile, refreshProfile, loading } = useAuth();
    const [username, setUsername] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        if (profile?.username) {
            setUsername(profile.username);
        }
    }, [profile]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setIsSaving(true);
        setMessage(null);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    username: username.trim()
                })
                .eq('id', user.id);

            if (error) throw error;

            await refreshProfile();
            setMessage({ type: 'success', text: 'Nombre de usuario actualizado correctamente.' });
        } catch (err: any) {
            console.error('Error updating profile:', err);
            const detail = err.message || err.details || (typeof err === 'object' ? JSON.stringify(err) : String(err));
            setMessage({ type: 'error', text: 'Error al actualizar el perfil: ' + detail });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Cargando perfil...</div>;

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
            <div>
                <Link href="/" className="text-sm text-slate-500 hover:text-emerald-600 mb-2 inline-block">← Volver al Inicio</Link>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Mi Perfil</h1>
                <p className="text-slate-500 mt-1">Personalice cómo se muestra su nombre en el sistema.</p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                <div className="p-8 border-b border-slate-50 bg-slate-50/30">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-full bg-emerald-600 flex items-center justify-center text-2xl font-black text-white shadow-lg shadow-emerald-200">
                            {(username || user?.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">{profile?.username || 'Sin nombre de usuario'}</h2>
                            <p className="text-slate-500 text-sm">{user?.email}</p>
                            <span className="inline-block mt-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                {profile?.role}
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
                            required
                        />
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

            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 mb-2">Seguridad</h3>
                <p className="text-xs text-slate-500 mb-4">
                    Su cuenta está protegida por Supabase Auth. Para cambiar su contraseña, contacte al Master Admin o utilice el flujo de recuperación de contraseña.
                </p>
            </div>
        </div>
    );
}
