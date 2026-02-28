'use client';

import { useState, useEffect } from 'react';
import { Observation } from '@/types';
import { db } from '@/services/db';
import { Button } from './ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { generateId } from '@/lib/uuid';

interface ObservationsSectionProps {
    clientId: string;
    farmId: string;
    lotId?: string; // If present, shows lot-specific observations
}

export function ObservationsSection({
    clientId,
    farmId,
    lotId
}: ObservationsSectionProps) {
    const [observations, setObservations] = useState<Observation[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
    const [formComments, setFormComments] = useState('');

    // Toggle for adding new vs viewing list
    const [isAdding, setIsAdding] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const { profile } = useAuth();
    const userName = profile?.username || profile?.email || 'Unknown';

    useEffect(() => {
        fetchObservations();
    }, [farmId, lotId]);

    async function fetchObservations() {
        setLoading(true);
        try {
            const all = await db.getAll('observations');
            const filtered = all.filter((o: Observation) =>
                o.clientId === clientId &&
                o.farmId === farmId &&
                (lotId ? o.lotId === lotId : !o.lotId) &&
                !o.deleted // Don't show deleted items
            );
            // Sort by date descending
            setObservations(filtered.sort((a: Observation, b: Observation) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        } catch (err) {
            console.error('Error fetching observations:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        if (!formComments.trim()) return;
        setIsSaving(true);
        try {
            if (editingId) {
                // Update existing
                const existing = observations.find(o => o.id === editingId);
                if (existing) {
                    const updated: Observation = {
                        ...existing,
                        date: formDate,
                        comments: formComments,
                        synced: false // Mark for sync
                    };
                    await db.put('observations', updated);
                    setObservations(observations.map(o => o.id === editingId ? updated : o));
                }
            } else {
                // Create new
                const newVal: Observation = {
                    id: generateId(),
                    clientId,
                    farmId,
                    lotId: lotId || undefined,
                    userName,
                    date: formDate,
                    comments: formComments,
                    createdAt: new Date().toISOString(),
                    synced: false
                };
                await db.put('observations', newVal);
                setObservations([newVal, ...observations]);
            }
            resetForm();
        } catch (err) {
            console.error('Error saving:', err);
            alert('Error al guardar');
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDelete(obs: Observation) {
        if (!confirm('¿Eliminar esta observación?')) return;
        try {
            const updated: Observation = {
                ...obs,
                deleted: true,
                deletedBy: userName,
                deletedAt: new Date().toISOString(),
                synced: false
            };
            await db.put('observations', updated);
            setObservations(observations.filter(o => o.id !== obs.id));
        } catch (err) {
            console.error('Error deleting:', err);
        }
    }

    function startEdit(obs: Observation) {
        setEditingId(obs.id);
        setFormDate(obs.date);
        setFormComments(obs.comments);
        setIsAdding(true); // Reuse the add form UI
    }

    function formatDate(dateStr: string) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    function resetForm() {
        setEditingId(null);
        setFormDate(new Date().toISOString().split('T')[0]);
        setFormComments('');
        setIsAdding(false);
    }

    return (
        <div className="animate-fadeIn">

            {/* Header / Actions */}


            {/* Form (Add / Edit) */}
            {isAdding && (
                <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm mb-6">
                    <h4 className="font-bold text-emerald-900 mb-3 block">
                        {editingId ? 'Editar Observación' : 'Nueva Observación'}
                    </h4>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha</label>
                            <input
                                type="date"
                                className="w-full text-sm rounded-lg border-slate-300 focus:ring-emerald-500 focus:border-emerald-500"
                                value={formDate}
                                onChange={e => setFormDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Comentario</label>
                            <textarea
                                className="w-full text-sm rounded-lg border-slate-300 focus:ring-emerald-500 focus:border-emerald-500 min-h-[80px]"
                                placeholder="Escriba aquí..."
                                value={formComments}
                                onChange={e => setFormComments(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                            <Button variant="secondary" size="sm" onClick={resetForm} disabled={isSaving}>
                                Cancelar
                            </Button>
                            <Button size="sm" onClick={handleSave} isLoading={isSaving} disabled={!formComments.trim()}>
                                {editingId ? 'Guardar Cambios' : 'Confirmar'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="text-center py-4 text-slate-400 text-sm">Cargando...</div>
            ) : observations.length === 0 && !isAdding ? (
                <div className="text-center py-6 text-slate-400 text-sm italic bg-white rounded-lg border border-dashed border-slate-200 mt-2">
                    No hay observaciones registradas.
                </div>
            ) : (
                <div className="space-y-3">
                    {observations.map(obs => (
                        <div
                            key={obs.id}
                            className={`p-3 bg-white rounded-lg border border-slate-200 hover:border-emerald-300 transition-all group ${editingId === obs.id ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                                    {obs.userName}
                                    <span className="text-slate-400 font-normal">•</span>
                                    <span className="text-slate-500 font-mono font-normal">{formatDate(obs.date)}</span>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    <button
                                        onClick={() => startEdit(obs)}
                                        className="p-1 text-slate-400 hover:text-emerald-600 rounded hover:bg-emerald-50"
                                        title="Editar"
                                    >
                                        ✎
                                    </button>
                                    <button
                                        onClick={() => handleDelete(obs)}
                                        className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
                                        title="Eliminar"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                {obs.comments}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {!isAdding && (
                <div className="mt-2 flex justify-end">
                    <Button size="sm" onClick={() => setIsAdding(true)}>
                        + Nueva Observación
                    </Button>
                </div>
            )}
        </div>
    );
}
