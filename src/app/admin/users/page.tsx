'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { UserProfile, UserRole, Client } from '@/types';
import { Button } from '@/components/ui/Button';
import { db } from '@/services/db';
import Link from 'next/link';

export default function UserManagementPage() {
    const { isMaster, loading: authLoading, user: currentUser, refreshProfile } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);

    const sortUsers = (userList: UserProfile[]) => {
        const roleOrder: Record<string, number> = {
            'MASTER_ADMIN': 1,
            'ADMIN': 2,
            'CLIENT': 3,
            'CONTRATISTA': 4
        };
        return [...userList].sort((a, b) => (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99));
    };

    useEffect(() => {
        if (!authLoading) {
            fetchData();
        }
    }, [authLoading]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch users (profiles table)
            const { data: profiles, error: pError } = await supabase
                .from('profiles')
                .select('*');

            if (pError) throw pError;
            setUsers(sortUsers(profiles || []));

            // Fetch clients from IndexedDB (or Supabase if synced)
            const allClients = await db.getAll('clients');
            setClients(allClients.filter((c: Client) => !c.deleted));

        } catch (err) {
            console.error('Error fetching admin data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId: string, newRole: UserRole) => {
        const userToChange = users.find(u => u.id === userId);
        if (!userToChange) return;

        // Requirement: There must always be at least one MASTER_ADMIN
        if (userToChange.role === 'MASTER_ADMIN' && newRole !== 'MASTER_ADMIN') {
            const otherMasters = users.filter(u => u.role === 'MASTER_ADMIN' && u.id !== userId);
            if (otherMasters.length === 0) {
                alert('Debe haber al menos un Master Admin en el sistema.');
                return;
            }
        }

        setSavingId(userId);
        try {
            const updateData: any = { role: newRole };

            // Requirement: Clients can only have ONE company assigned (or none initially)
            // If role changes to CLIENT, we clear existing assignments to avoid forbidden state
            if (newRole === 'CLIENT') {
                updateData.assigned_clients = [];
            }

            const { error } = await supabase
                .from('profiles')
                .update(updateData)
                .eq('id', userId);

            if (error) throw error;

            setUsers(sortUsers(users.map(u => u.id === userId ? { ...u, ...updateData } : u)));
        } catch (err) {
            console.error('Error updating role:', err);
            alert('Error al actualizar el rol');
        } finally {
            setSavingId(null);
        }
    };


    const handleClientAssignment = async (userId: string, clientId: string, isAssigned: boolean) => {
        setSavingId(userId);
        try {
            const user = users.find(u => u.id === userId);
            if (!user) return;

            let newAssignments = [...(user.assigned_clients || [])];
            if (isAssigned) {
                if (user.role === 'CLIENT') {
                    // For clients, only one is allowed. Replace the previous one.
                    newAssignments = [clientId];
                } else {
                    if (!newAssignments.includes(clientId)) newAssignments.push(clientId);
                }
            } else {
                newAssignments = newAssignments.filter(id => id !== clientId);
            }

            const { error } = await supabase
                .from('profiles')
                .update({ assigned_clients: newAssignments })
                .eq('id', userId);

            if (error) {
                console.error('Supabase update error:', error);
                throw error;
            }

            setUsers(users.map(u => u.id === userId ? { ...u, assigned_clients: newAssignments } : u));

            // CRITICAL: Refresh local profile if I assigned clients to myself!
            if (userId === currentUser?.id) {
                await refreshProfile();
            }
        } catch (err: any) {
            console.error('Error updating assignments:', err);
            alert(`Error al actualizar asignaciones: ${err.message || 'Error desconocido'}`);
        } finally {
            setSavingId(null);
        }
    };

    const [showNewUserModal, setShowNewUserModal] = useState(false);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUserEmail || !newUserPassword) return;
        if (newUserPassword.length < 6) {
            alert('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        setIsCreating(true);
        try {
            // Create a temporary client WITHOUT session persistence to avoid logging out the admin
            const { createClient } = await import('@supabase/supabase-js');
            const tempClient = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL || '',
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
                {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false,
                        detectSessionInUrl: false
                    }
                }
            );

            const { data, error } = await tempClient.auth.signUp({
                email: newUserEmail,
                password: newUserPassword,
            });

            if (error) throw error;

            alert('Usuario creado con éxito. Se ha enviado un correo de confirmación (si está habilitado) o el usuario ya puede ingresar.');
            setShowNewUserModal(false);
            setNewUserEmail('');
            setNewUserPassword('');
            fetchData(); // Refresh list
        } catch (err: any) {
            console.error('Error creating user:', err);
            alert(`Error al crear usuario: ${err.message}`);
        } finally {
            setIsCreating(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="p-8 text-center text-slate-500">Cargando gestión de usuarios...</div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Gestión de Usuarios</h1>
                    <p className="text-slate-500 mt-1">
                        {isMaster ? 'Administre roles y asignaciones de clientes.' : 'Directorio de usuarios y asignaciones.'}
                    </p>
                </div>
                {isMaster && (
                    <Button
                        onClick={() => setShowNewUserModal(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
                    >
                        <span className="text-xl leading-none">+</span>
                        Nuevo Usuario
                    </Button>
                )}
            </div>

            {/* Modal de Nuevo Usuario */}
            {showNewUserModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-900">Crear Nuevo Usuario</h2>
                            <button onClick={() => setShowNewUserModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">×</button>
                        </div>
                        <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</label>
                                <input
                                    type="email"
                                    required
                                    className="w-full rounded-lg border-slate-300 focus:border-emerald-500 focus:ring-emerald-500"
                                    value={newUserEmail}
                                    onChange={(e) => setNewUserEmail(e.target.value)}
                                    placeholder="ejemplo@correo.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    className="w-full rounded-lg border-slate-300 focus:border-emerald-500 focus:ring-emerald-500"
                                    value={newUserPassword}
                                    onChange={(e) => setNewUserPassword(e.target.value)}
                                    placeholder="Min. 6 caracteres"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="flex-1"
                                    onClick={() => setShowNewUserModal(false)}
                                    disabled={isCreating}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                    isLoading={isCreating}
                                >
                                    {isCreating ? 'Creando...' : 'Crear Usuario'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Editar Perfil Removed */}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider text-nowrap">Usuario / Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider text-nowrap">Rol</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider text-nowrap">Empresas Asignadas</th>
                                {isMaster && <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider text-nowrap"></th>}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-50 transition-colors group relative">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="text-sm font-medium text-slate-900">
                                                {user.role === 'CLIENT' ? (
                                                    user.email
                                                ) : (
                                                    <>
                                                        {user.username && user.username !== user.email && (
                                                            <div className="text-slate-900 font-bold">{user.username}</div>
                                                        )}
                                                        <div className={user.username && user.username !== user.email ? "text-xs text-slate-500" : ""}>
                                                            {user.email}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            {isMaster && (
                                                <Link
                                                    href={`/admin/users/${user.id}`}
                                                    className="text-slate-300 hover:text-emerald-500 transition-colors p-1"
                                                    title="Gestionar perfil completo"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                                                </Link>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {isMaster ? (
                                            <select
                                                className="text-sm rounded-lg border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 p-1 disabled:opacity-50"
                                                value={user.role}
                                                onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                                                disabled={savingId === user.id}
                                            >
                                                <option value="CLIENT">Cliente (Solo Lectura Stock)</option>
                                                <option value="CONTRATISTA">Contratista (Solo Órdenes)</option>
                                                <option value="ADMIN">Admin (Acceso total al cliente)</option>
                                                <option value="MASTER_ADMIN">Master Admin (Sistema)</option>
                                            </select>
                                        ) : (
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${user.role === 'MASTER_ADMIN' ? 'bg-purple-100 text-purple-700' :
                                                user.role === 'ADMIN' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-slate-100 text-slate-700'
                                                }`}>
                                                {user.role}
                                            </span>
                                        )}
                                    </td>
                                    {/* CUIT removed for users */}
                                    <td className="px-6 py-4">
                                        {isMaster ? (
                                            <div className="flex flex-wrap gap-2 max-w-md items-center min-w-[300px]">
                                                {clients.map(client => {
                                                    const isAssigned = user.assigned_clients?.includes(client.id);
                                                    return (
                                                        <button
                                                            key={client.id}
                                                            onClick={() => handleClientAssignment(user.id, client.id, !isAssigned)}
                                                            disabled={savingId === user.id}
                                                            className={`text-xs px-2 py-1 rounded-full border transition-all ${isAssigned
                                                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200 font-medium'
                                                                : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300'
                                                                }`}
                                                        >
                                                            {client.name}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-sm text-slate-600">
                                                {clients
                                                    .filter(c => user.assigned_clients?.includes(c.id))
                                                    .map(c => c.name)
                                                    .join(', ') || <span className="text-slate-400 italic font-light">Ninguno</span>}
                                            </div>
                                        )}
                                    </td>
                                    {isMaster && (
                                        <td className="px-6 py-4 whitespace-nowrap text-right relative">
                                            <div className="group/tooltip inline-block">
                                                <button
                                                    onClick={async () => {
                                                        if (user.role === 'MASTER_ADMIN') {
                                                            alert('No se puede eliminar un Master Admin.');
                                                            return;
                                                        }
                                                        if (confirm(`¿Eliminar usuario ${user.email}? Esta acción es irreversible.`)) {
                                                            setSavingId(user.id);
                                                            try {
                                                                const { error } = await supabase.rpc('delete_user_entirely', {
                                                                    user_id_to_delete: user.id
                                                                });
                                                                if (error) throw error;
                                                                setUsers(users.filter(u => u.id !== user.id));
                                                            } catch (e) {
                                                                console.error(e);
                                                                alert('Error al eliminar usuario');
                                                            } finally {
                                                                setSavingId(null);
                                                            }
                                                        }
                                                    }}
                                                    className="h-8 w-8 rounded-full bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-all font-bold text-lg"
                                                    disabled={savingId === user.id}
                                                >
                                                    −
                                                </button>
                                                <div className="absolute right-10 top-1/2 -translate-y-1/2 px-2 py-1 bg-white text-slate-700 text-xs rounded border border-slate-200 shadow-md opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                                    Eliminar
                                                </div>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {
                users.length === 0 && (
                    <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
                        <p className="text-slate-500 italic">No hay otros usuarios registrados en el sistema.</p>
                    </div>
                )
            }
        </div >
    );
}
