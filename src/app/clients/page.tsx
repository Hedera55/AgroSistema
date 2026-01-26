'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useInventory } from '@/hooks/useInventory';
import { Client } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { generateId } from '@/lib/uuid';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

export default function ClientsPage() {
    const { role, isMaster, profile, assignedId } = useAuth();
    const router = useRouter();
    const { clients, addClient, deleteClient, loading } = useInventory();

    // State for client selection persistence
    const [persistedClientId, setPersistedClientId] = useState<string | null>(null);

    useEffect(() => {
        const saved = localStorage.getItem('lastSelectedClientId');
        setPersistedClientId(saved);
    }, []);

    useEffect(() => {
        if (role === 'CLIENT' && assignedId) {
            router.push(`/clients/${assignedId}`);
        }
    }, [role, assignedId, router]);
    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const handleDeselect = (e: React.MouseEvent) => {
        e.preventDefault();
        localStorage.removeItem('lastSelectedClientId');
        setSelectedId(null);
        window.dispatchEvent(new CustomEvent('clientSelectionChanged'));
    };

    useEffect(() => {
        const saved = localStorage.getItem('lastSelectedClientId');
        setSelectedId(saved);

        // Listen for storage changes (for sync between tabs or components)
        const handleStorage = () => {
            setSelectedId(localStorage.getItem('lastSelectedClientId'));
        };
        window.addEventListener('storage', handleStorage);
        // Custom event for same-tab updates
        window.addEventListener('clientSelectionChanged', handleStorage);

        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('clientSelectionChanged', handleStorage);
        };
    }, []);

    const [showAll, setShowAll] = useState(false);

    const filteredClients = useMemo(() => {
        // If admin/master and showAll is on, show everything
        if ((isMaster || role === 'ADMIN') && showAll) return clients;

        // Otherwise, filter by assignments for everyone
        if (profile?.assigned_clients) {
            return clients.filter(c => profile.assigned_clients?.includes(c.id));
        }

        // If master has NO assignments and showAll is off, they see nothing by default
        // as per "clientes asignados is the only one I want to show anyway"
        return [];
    }, [clients, isMaster, showAll, profile]);

    const [newClient, setNewClient] = useState({ name: '', email: '', phone: '', cuit: '' });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newClient.name) return;

        setIsSubmitting(true);
        try {
            await addClient({
                id: generateId(),
                name: newClient.name,
                email: newClient.email,
                phone: newClient.phone,
                cuit: newClient.cuit
            });
            setShowForm(false);
            setNewClient({ name: '', email: '', phone: '', cuit: '' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Clientes</h1>
                </div>
                <div className="flex items-center gap-3">
                    {selectedId && (isMaster || role === 'ADMIN') && (
                        <button
                            onClick={handleDeselect}
                            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all text-xl"
                            title="Deseleccionar cliente"
                        >
                            ✕
                        </button>
                    )}
                    {isMaster && (
                        <Button onClick={() => setShowForm(!showForm)}>
                            {showForm ? 'Cancelar' : 'Agregar Cliente'}
                        </Button>
                    )}
                </div>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 animate-fadeIn">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4">Nuevo Cliente</h2>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <Input
                            label="Nombre"
                            placeholder="ej. Estancia La Paz"
                            value={newClient.name}
                            onChange={e => setNewClient({ ...newClient, name: e.target.value })}
                            required
                        />
                        <Input
                            label="Email"
                            type="text"
                            placeholder="Email o referencia"
                            value={newClient.email}
                            onChange={e => setNewClient({ ...newClient, email: e.target.value })}
                        />
                        <Input
                            label="Teléfono"
                            type="text"
                            placeholder="ej. +54 9 11..."
                            value={newClient.phone}
                            onChange={e => setNewClient({ ...newClient, phone: e.target.value })}
                        />
                        <Input
                            label="CUIT"
                            type="text"
                            placeholder="ej. 30-12345678-9"
                            value={newClient.cuit}
                            onChange={e => setNewClient({ ...newClient, cuit: e.target.value })}
                        />
                        <Button type="submit" isLoading={isSubmitting} className="md:col-start-3">
                            Guardar Cliente
                        </Button>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <div className="col-span-full text-center py-12 text-slate-500">Cargando clientes...</div>
                ) : filteredClients.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                        <div className="text-4xl mb-2">👥</div>
                        <h3 className="text-lg font-medium text-slate-900">No hay clientes aún</h3>
                        <p className="text-slate-500">
                            {isMaster
                                ? "Agregue un cliente para comenzar a gestionar sus campos y stock."
                                : "No tiene clientes asignados. Contacte al administrador Master."}
                        </p>
                    </div>
                ) : (
                    filteredClients.map(client => {
                        const isSelected = client.id === selectedId;
                        return (
                            <div
                                key={client.id}
                                onClick={() => {
                                    if (isSelected) {
                                        router.push(`/clients/${client.id}`);
                                    } else {
                                        localStorage.setItem('lastSelectedClientId', client.id);
                                        setSelectedId(client.id);
                                        window.dispatchEvent(new CustomEvent('clientSelectionChanged'));
                                    }
                                }}
                                className={`group relative bg-white p-6 rounded-xl shadow-sm border transition-all cursor-pointer ${isSelected
                                    ? 'border-emerald-500 ring-2 ring-emerald-500/10 shadow-md transform scale-[1.02]'
                                    : 'border-slate-200 hover:border-emerald-300 hover:shadow-md'
                                    }`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="pr-8">
                                        <h3 className={`text-lg font-bold transition-colors ${isSelected ? 'text-emerald-700' : 'text-slate-900 group-hover:text-emerald-700'}`}>
                                            {client.name}
                                        </h3>
                                        <div className="mt-2 space-y-1 text-sm text-slate-500">
                                            {client.cuit && <div className="flex items-center gap-2 font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded w-fit mb-1">CUIT: {client.cuit}</div>}
                                            {client.email && <div className="flex items-center gap-2">📧 {client.email}</div>}
                                            {client.phone && <div className="flex items-center gap-2">📱 {client.phone}</div>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isMaster && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm(`¿Eliminar cliente "${client.name}"? Esto no se puede deshacer.`)) {
                                                        deleteClient(client.id);
                                                    }
                                                }}
                                                className="h-8 w-8 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors z-10"
                                                title="Eliminar Cliente"
                                            >
                                                🗑️
                                            </button>
                                        )}
                                        <div className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${isSelected ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600'}`}>
                                            →
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {(isMaster || role === 'ADMIN') && !loading && (
                <div className="flex justify-end pt-2">
                    <button
                        onClick={() => setShowAll(!showAll)}
                        className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full border border-slate-200 shadow-sm hover:text-slate-600 hover:bg-white transition-all"
                    >
                        {showAll ? 'Ver Mis Asignados' : 'Ver Todos los Clientes'}
                    </button>
                </div>
            )}
        </div>
    );
}
