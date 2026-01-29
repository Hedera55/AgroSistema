import { useState, useMemo } from 'react';
import { ClientStock, Warehouse } from '@/types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

interface StockMovementPanelProps {
    selectedIds: string[];
    stockItems: any[]; // enriched items
    warehouses: Warehouse[]; // for transfer destination
    activeWarehouseId: string | null;
    onConfirm: (action: 'WITHDRAW' | 'TRANSFER', quantities: Record<string, number>, destinationWarehouseId?: string, note?: string) => Promise<void>;
    onCancel: () => void;
}

export function StockMovementPanel({
    selectedIds,
    stockItems,
    warehouses,
    activeWarehouseId,
    onConfirm,
    onCancel
}: StockMovementPanelProps) {
    const [action, setAction] = useState<'WITHDRAW' | 'TRANSFER'>('WITHDRAW');
    const [destinationId, setDestinationId] = useState('');
    const [note, setNote] = useState('');
    const [showNote, setShowNote] = useState(false);
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false);

    // Filter active items
    const selectedItems = useMemo(() => {
        return stockItems.filter((item: any) => selectedIds.includes(item.id));
    }, [stockItems, selectedIds]);

    // Initialize quantities with max available on mount (or when items change)
    useMemo(() => {
        const initial: Record<string, number> = {};
        selectedItems.forEach((item: any) => {
            initial[item.id] = item.quantity;
        });
        // Only set if empty (to avoid overwriting user edits on re-renders if any)
        // But actually useMemo runs on render. proper way is useEffect or lazy init.
        // We'll calculate defaults and merge for the UI, but state tracks overrides.
        // Let's just use state initialized in effect.
    }, [selectedItems]);

    // Better: Effect to init quantities
    useState(() => {
        // This runs only once, we need effect if selection changes? 
        // Component will likely be re-mounted when opened.
    });

    // We'll manage state properly:
    if (Object.keys(quantities).length === 0 && selectedItems.length > 0) {
        const initial: Record<string, number> = {};
        selectedItems.forEach((item: any) => initial[item.id] = item.quantity);
        setQuantities(initial);
    }

    const handleQuantityChange = (id: string, val: string) => {
        setQuantities(prev => ({ ...prev, [id]: parseFloat(val) || 0 }));
    };

    const handleSubmit = async () => {
        if (action === 'TRANSFER' && !destinationId) {
            alert('Seleccione un galpón de destino');
            return;
        }
        setLoading(true);
        try {
            await onConfirm(action, quantities, destinationId || undefined, note);
        } catch (e) {
            console.error(e);
            alert('Error al procesar movimiento');
        } finally {
            setLoading(false);
        }
    };

    const validWarehouses = warehouses.filter((w: Warehouse) => w.id !== activeWarehouseId);

    return (
        <div className="bg-white p-4 rounded-xl shadow-lg border border-indigo-100 animate-fadeIn mb-4 relative">
            <button
                onClick={onCancel}
                className="absolute top-2 right-2 text-slate-400 hover:text-red-500"
            >
                ✕
            </button>
            <h3 className="text-lg font-semibold text-slate-800 mb-3">
                Mover Stock Seleccionado ({selectedItems.length})
            </h3>

            <div className="flex gap-3 mb-4">
                <button
                    type="button"
                    onClick={() => setAction('WITHDRAW')}
                    className={`flex-1 py-2 rounded-lg border font-bold text-sm transition-all flex items-center justify-center gap-2 ${action === 'WITHDRAW'
                        ? '!bg-orange-50 !border-orange-200 !text-orange-700 !ring-2 !ring-orange-100'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="19" x2="12" y2="5"></line>
                        <polyline points="5 12 12 5 19 12"></polyline>
                    </svg>
                    Retirar Stock
                </button>
                <button
                    type="button"
                    onClick={() => setAction('TRANSFER')}
                    className={`flex-1 py-2 rounded-lg border font-bold text-sm transition-all ${action === 'TRANSFER'
                        ? 'text-orange-700 ring-2 ring-orange-100'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                    style={action === 'TRANSFER' ? { backgroundColor: '#fff7ed', borderColor: '#fed7aa', color: '#c2410c' } : {}}
                >
                    ⇆ Transferir a otro Galpón
                </button>
            </div>

            <div className="space-y-2 mb-4 max-h-[200px] overflow-y-auto pr-2">
                {selectedItems.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex-1">
                            <div className="font-bold text-slate-700 text-sm">
                                {item.productName}
                            </div>
                            <div className="text-xs text-slate-500">
                                Disponibles: <span className="font-mono font-bold">{item.quantity} {item.unit}</span>
                            </div>
                        </div>
                        <div className="w-28">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cantidad</label>
                            <Input
                                type="number"
                                min="0"
                                max={item.quantity}
                                value={quantities[item.id] ?? item.quantity}
                                onChange={e => handleQuantityChange(item.id, e.target.value)}
                                className="h-8 text-right font-mono text-sm"
                            />
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {action === 'TRANSFER' && (
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Galpón de Destino</label>
                        <select
                            className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm py-1.5"
                            value={destinationId}
                            onChange={e => setDestinationId(e.target.value)}
                        >
                            <option value="">Seleccionar destino...</option>
                            {validWarehouses.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                    </div>
                )}
                <div className={action === 'TRANSFER' ? '' : 'col-span-2'}>
                    {!showNote ? (
                        <button
                            type="button"
                            onClick={() => setShowNote(true)}
                            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline mt-1"
                        >
                            + Agregar Nota
                        </button>
                    ) : (
                        <div className="animate-fadeIn">
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-medium text-slate-700">Nota (Opcional)</label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowNote(false);
                                        setNote('');
                                    }}
                                    className="text-[10px] text-red-400 hover:text-red-600 font-medium"
                                >
                                    ✕ Quitar
                                </button>
                            </div>
                            <Input
                                placeholder="Razón, destino específico, etc..."
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                className="text-sm py-1.5"
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={onCancel}>
                    Cancelar
                </Button>
                <Button
                    onClick={handleSubmit}
                    isLoading={loading}
                    size="sm"
                    className="!bg-orange-600 !hover:bg-orange-700 !text-white"
                    style={{ backgroundColor: '#ea580c', color: 'white' }}
                >
                    {action === 'WITHDRAW' ? 'Confirmar Retiro' : 'Confirmar Transferencia'}
                </Button>
            </div>
        </div>
    );
}
