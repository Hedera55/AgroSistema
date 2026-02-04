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
    const { clients, addClient, updateClient, deleteClient, loading } = useInventory();

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
    const [isEditing, setIsEditing] = useState(false);
    const [editingClientId, setEditingClientId] = useState<string | null>(null);

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

    const [newClient, setNewClient] = useState<{ name: string; cuit: string; partners: { name: string; cuit: string }[] }>({
        name: '',
        cuit: '',
        partners: []
    });
    const [activePartner, setActivePartner] = useState({ name: '', cuit: '' });
    const [showPartnerRibbon, setShowPartnerRibbon] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newClient.name) return;

        setIsSubmitting(true);
        try {
            const clientData = {
                id: isEditing ? editingClientId! : generateId(),
                name: newClient.name,
                cuit: newClient.cuit,
                partners: newClient.partners
            };

            if (isEditing) {
                await updateClient(clientData as Client);
            } else {
                await addClient(clientData);
            }
            setShowForm(false);
            setIsEditing(false);
            setEditingClientId(null);
            setNewClient({ name: '', cuit: '', partners: [] });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Empresas</h1>
                </div>
                <div className="flex items-center gap-3">
                    {selectedId && (isMaster || role === 'ADMIN') && (
                        <button
                            onClick={handleDeselect}
                            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all text-xl"
                            title="Deseleccionar empresa"
                        >
                            ✕
                        </button>
                    )}
                    {isMaster && (
                        <Button onClick={() => {
                            if (!showForm) {
                                setIsEditing(false);
                                setEditingClientId(null);
                                setNewClient({ name: '', cuit: '', partners: [] });
                            }
                            setShowForm(!showForm);
                        }}>
                            {showForm ? 'Cancelar' : 'Agregar Empresa'}
                        </Button>
                    )}
                </div>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 animate-fadeIn relative">
                    <button
                        onClick={() => {
                            setIsEditing(false);
                            setEditingClientId(null);
                            setNewClient({ name: '', cuit: '', partners: [] });
                            setShowForm(false);
                        }}
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Cancelar"
                    >
                        ✕
                    </button>

                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-slate-800">
                            {isEditing ? `Editar empresa ${newClient.name}` : 'Nueva Empresa'}
                        </h2>
                        {isEditing && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (confirm(`¿Eliminar empresa "${newClient.name}"? Esto no se puede deshacer.`)) {
                                        deleteClient(editingClientId!);
                                        setShowForm(false);
                                        setIsEditing(false);
                                        setEditingClientId(null);
                                        setNewClient({ name: '', cuit: '', partners: [] });
                                    }
                                }}
                                className="text-xs font-bold text-red-400 hover:text-red-600 uppercase tracking-widest transition-colors mr-6"
                            >
                                ✕ Eliminar Empresa
                            </button>
                        )}
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Nombre de la Empresa"
                                placeholder="ej. Estancia La Paz"
                                value={newClient.name}
                                onChange={e => setNewClient({ ...newClient, name: e.target.value })}
                                required
                            />
                            <Input
                                label="CUIT de la Empresa"
                                type="text"
                                placeholder="ej. 30-12345678-9"
                                value={newClient.cuit}
                                onChange={e => setNewClient({ ...newClient, cuit: e.target.value })}
                            />
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-slate-900">Inversores</h3>
                                <button
                                    type="button"
                                    onClick={() => setShowPartnerRibbon(!showPartnerRibbon)}
                                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-widest transition-colors"
                                >
                                    {showPartnerRibbon ? 'Cancelar' : '+ Agregar Inversor'}
                                </button>
                            </div>

                            {/* Active Ribbon */}
                            {showPartnerRibbon && (
                                <div className="flex flex-col md:flex-row gap-3 items-end mb-6 animate-fadeIn bg-slate-50/50 p-4 rounded-xl border border-slate-100/50">
                                    <div className="flex-1 w-full">
                                        <Input
                                            label="Nombre Inversor"
                                            placeholder="ej. Juan Pérez"
                                            value={activePartner.name}
                                            onChange={e => setActivePartner({ ...activePartner, name: e.target.value })}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && activePartner.name) {
                                                    setNewClient({
                                                        ...newClient,
                                                        partners: [...newClient.partners, { ...activePartner }]
                                                    });
                                                    setActivePartner({ name: '', cuit: '' });
                                                    setShowPartnerRibbon(false);
                                                }
                                            }}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="flex-[0.7] w-full">
                                        <Input
                                            label="CUIT"
                                            placeholder="20-12345678-9"
                                            value={activePartner.cuit}
                                            onChange={e => setActivePartner({ ...activePartner, cuit: e.target.value })}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && activePartner.name) {
                                                    setNewClient({
                                                        ...newClient,
                                                        partners: [...newClient.partners, { ...activePartner }]
                                                    });
                                                    setActivePartner({ name: '', cuit: '' });
                                                    setShowPartnerRibbon(false);
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (activePartner.name) {
                                                    setNewClient({
                                                        ...newClient,
                                                        partners: [...newClient.partners, { ...activePartner }]
                                                    });
                                                    setActivePartner({ name: '', cuit: '' });
                                                    setShowPartnerRibbon(false);
                                                }
                                            }}
                                            className={`h-10 w-10 flex items-center justify-center rounded-lg shadow-sm transition-all ${activePartner.name ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-100 text-slate-300 pointer-events-none'}`}
                                            title="Agregar a la lista"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowPartnerRibbon(false)}
                                            className="h-10 w-10 flex items-center justify-center text-slate-400 hover:text-slate-600 bg-white border border-slate-200 rounded-lg transition-colors shadow-sm"
                                            title="Cerrar"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Growing List */}
                            {newClient.partners.length === 0 ? (
                                <p className="text-sm text-slate-400 italic py-4">No ha agregado inversores para esta empresa.</p>
                            ) : (
                                <div className="space-y-2 mb-6 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                    {newClient.partners.map((partner, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-emerald-200 transition-all group animate-fadeIn">
                                            <div className="flex-1">
                                                <div className="font-bold text-slate-900 text-sm">{partner.name}</div>
                                                {partner.cuit && <div className="text-[10px] text-slate-400 font-mono tracking-wider">{partner.cuit}</div>}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const p = newClient.partners.filter((_, i) => i !== idx);
                                                    setNewClient({ ...newClient, partners: p });
                                                }}
                                                className="text-slate-300 hover:text-red-500 p-2 transition-colors"
                                                title="Eliminar Inversor"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setIsEditing(false);
                                    setEditingClientId(null);
                                    setNewClient({ name: '', cuit: '', partners: [] });
                                    setShowForm(false);
                                    setShowPartnerRibbon(false);
                                }}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" isLoading={isSubmitting} className="min-w-[200px]">
                                {isEditing ? 'Confirmar' : 'Guardar Empresa'}
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <div className="col-span-full text-center py-12 text-slate-500">Cargando clientes...</div>
                ) : filteredClients.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                        <div className="text-4xl mb-2">👥</div>
                        <h3 className="text-lg font-medium text-slate-900">No hay empresas aún</h3>
                        <p className="text-slate-500">
                            {isMaster
                                ? "Agregue una empresa para comenzar a gestionar sus campos y stock."
                                : "No tiene empresas asignadas. Contacte al administrador Master."}
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
                                            {/* Extra info removed as per user request */}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isMaster && (
                                            <>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setNewClient({
                                                            name: client.name,
                                                            cuit: client.cuit || '',
                                                            partners: (client.partners || []).map(p => ({ name: p.name, cuit: p.cuit || '' }))
                                                        });
                                                        setShowPartnerRibbon(false);
                                                        setEditingClientId(client.id);
                                                        setIsEditing(true);
                                                        setShowForm(true);
                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }}
                                                    className="h-8 w-8 rounded-full flex items-center justify-center text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 transition-colors z-10"
                                                    title="Editar Empresa"
                                                >
                                                    ✏️
                                                </button>
                                            </>
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

            {
                (isMaster || role === 'ADMIN') && !loading && (
                    <div className="flex justify-end pt-2">
                        <button
                            onClick={() => setShowAll(!showAll)}
                            className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full border border-slate-200 shadow-sm hover:text-slate-600 hover:bg-white transition-all"
                        >
                            {showAll ? 'Ver Mis Asignados' : 'Ver Todas las Empresas'}
                        </button>
                    </div>
                )
            }
        </div >
    );
}
