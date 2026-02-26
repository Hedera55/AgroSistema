'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { db } from '@/services/db';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Link from 'next/link';
import { Product, Warehouse, InventoryMovement, ClientStock, Lot, Order, Campaign } from '@/types';

type EntityStore = 'stock' | 'movements' | 'lotes' | 'money';

export default function BaseTableEditor({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { role, isMaster, loading: authLoading } = useAuth();
    const router = useRouter();
    const [activeStore, setActiveStore] = useState<EntityStore>('stock');
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<any>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [lookups, setLookups] = useState<{
        products: Product[],
        warehouses: Warehouse[],
        campaigns: Campaign[],
        lots: Lot[],
        farms: any[]
    }>({
        products: [],
        warehouses: [],
        campaigns: [],
        lots: [],
        farms: []
    });

    // Filters for Stock
    const [stockFilter, setStockFilter] = useState<'ALL' | 'INSUMOS' | 'GRANOS'>('ALL');

    useEffect(() => {
        if (!authLoading && role !== 'ADMIN' && !isMaster) {
            router.push(`/clients/${id}`);
        }
    }, [role, isMaster, authLoading, router, id]);

    useEffect(() => {
        loadData();
        loadLookups();
    }, [activeStore, id]);

    async function loadLookups() {
        const [ps, ws, cs, ls, fs] = await Promise.all([
            db.getAll('products'),
            db.getAll('warehouses'),
            db.getAll('campaigns'),
            db.getAll('lots'),
            db.getAll('farms')
        ]);
        setLookups({
            products: ps.filter((p: any) => !p.clientId || p.clientId === id),
            warehouses: ws.filter((w: any) => w.clientId === id),
            campaigns: cs.filter((c: any) => c.clientId === id),
            lots: ls.filter((l: any) => {
                const farm = fs.find((f: any) => f.id === l.farmId);
                return farm?.clientId === id;
            }),
            farms: fs.filter((f: any) => f.clientId === id)
        });
    }

    async function loadData() {
        setLoading(true);
        try {
            if (activeStore === 'stock') {
                const all = await db.getAll('stock');
                setData(all.filter((s: any) => s.clientId === id));
            } else if (activeStore === 'movements') {
                const all = await db.getAll('movements');
                setData(all.filter((m: any) => m.clientId === id).sort((a: any, b: any) => b.date.localeCompare(a.date)));
            } else if (activeStore === 'lotes') {
                const [lots, orders, movs] = await Promise.all([
                    db.getAll('lots'),
                    db.getAll('orders'),
                    db.getAll('movements')
                ]);

                const clientLots = lots.filter((l: any) => {
                    const farm = lookups.farms.find((f: any) => f.id === l.farmId);
                    return farm?.clientId === id;
                });

                // Enriched Lot Lifecycle Data
                const enrichedLots = clientLots.map((l: any) => {
                    // Find sowing order
                    const sowingOrder = orders.find((o: any) => o.type === 'SOWING' && (o.lotId === l.id || o.lotIds?.includes(l.id)));
                    // Find harvest movement or order
                    const harvestMov = movs.find((m: any) => m.type === 'HARVEST' && m.lotId === l.id);
                    const harvestOrder = orders.find((o: any) => o.type === 'HARVEST' && (o.lotId === l.id || o.lotIds?.includes(l.id)));

                    return {
                        ...l,
                        sowingDate: sowingOrder?.appliedAt || sowingOrder?.date || '-',
                        harvestDate: harvestMov?.date || harvestOrder?.appliedAt || harvestOrder?.date || '-',
                        // If no observed yield yet, use harvest movement quantity / hectares
                        displayYield: l.observedYield || (harvestMov ? (harvestMov.quantity / l.hectares) : '-')
                    };
                });

                setData(enrichedLots); // We'll group in render
            } else if (activeStore === 'money') {
                const [movs, orders] = await Promise.all([
                    db.getAll('movements'),
                    db.getAll('orders')
                ]);

                const clientMovs = movs.filter((m: any) => m.clientId === id);
                const clientOrders = orders.filter((o: any) => o.clientId === id);

                // Transform into Ledger rows
                const ledger: any[] = [];

                // Add Movements (Purchases/Sales)
                clientMovs.forEach((m: any) => {
                    const isTransfer = m.notes?.toLowerCase().includes('transfer') || m.notes?.toLowerCase().includes('traslado');
                    if (isTransfer) return;

                    if (m.type === 'IN') {
                        const price = m.purchasePrice || 0;
                        ledger.push({
                            id: m.id,
                            date: m.date,
                            concept: `Compra: ${m.productName || 'Insumo'}`,
                            category: 'INSUMO',
                            amount: -(m.quantity * price),
                            detail: `${m.quantity} ${m.unit} @ USD ${price}`
                        });
                    } else if (m.type === 'SALE') {
                        const price = m.salePrice || 0;
                        ledger.push({
                            id: m.id,
                            date: m.date,
                            concept: `Venta: ${m.productName || 'Grano'}`,
                            category: 'VENTA',
                            amount: (m.quantity * price),
                            detail: `${m.quantity} ${m.unit} @ USD ${price}`
                        });
                    }
                });

                // Add Contractor Costs (from Orders)
                clientOrders.forEach((o: any) => {
                    if (o.servicePrice && o.servicePrice > 0) {
                        ledger.push({
                            id: `${o.id}-labor`,
                            date: o.appliedAt || o.date,
                            concept: `Servicio: ${o.type === 'HARVEST' ? 'Cosecha' : 'Labor'}`,
                            category: 'CONTRATISTA',
                            amount: -(o.servicePrice * (o.treatedArea || 0)),
                            detail: `${o.treatedArea} ha @ USD ${o.servicePrice}/ha`
                        });
                    }
                });

                setData(ledger.sort((a: any, b: any) => b.date.localeCompare(a.date)));
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    }

    const handleEdit = (item: any) => {
        setEditingId(item.id);
        setEditValues({ ...item });
    };

    const handleSave = async () => {
        if (!editingId) return;

        try {
            const originalItem = data.find((item: any) => item.id === editingId);
            const updatedItem = { ...editValues, updatedAt: new Date().toISOString(), synced: false };

            // Note: lotes/money views are derived, editing them might need more logic
            // For now, if editing movements/stock, we use the direct store name
            let storeToUpdate: any = activeStore;
            if (activeStore === 'money') storeToUpdate = 'movements'; // Money edits movements

            await db.put(storeToUpdate, updatedItem);

            if (storeToUpdate === 'movements' && originalItem) {
                await adjustStockForMovementEdit(originalItem, updatedItem);
            }

            setData(data.map((item: any) => item.id === editingId ? updatedItem : item));
            setEditingId(null);
            setEditValues({});
        } catch (error) {
            alert('Error al guardar los cambios');
            console.error(error);
        }
    };

    const adjustStockForMovementEdit = async (oldMov: InventoryMovement, newMov: InventoryMovement) => {
        if (oldMov.productId !== newMov.productId || oldMov.warehouseId !== newMov.warehouseId) return;

        const diff = parseFloat(String(newMov.quantity)) - parseFloat(String(oldMov.quantity));
        if (diff === 0) return;

        const stocks = await db.getAll('stock');
        const stockEntry = stocks.find((s: ClientStock) => s.productId === newMov.productId && s.warehouseId === newMov.warehouseId && s.clientId === id);

        if (stockEntry) {
            const isOut = ['OUT', 'SALE'].includes(newMov.type);
            const isIn = ['IN', 'HARVEST'].includes(newMov.type);

            let newBalance = stockEntry.quantity;
            if (isOut) newBalance -= diff;
            if (isIn) newBalance += diff;

            await db.put('stock', { ...stockEntry, quantity: newBalance, updatedAt: new Date().toISOString(), synced: false });
        }
    };

    const handleDelete = async (idToDelete: string) => {
        if (!confirm('¿Está seguro de eliminar este registro?')) return;

        try {
            const itemToDelete = data.find((item: any) => item.id === idToDelete);
            let storeToDelete: any = activeStore;
            if (activeStore === 'money') storeToDelete = 'movements';

            await db.delete(storeToDelete, idToDelete);

            if (storeToDelete === 'movements' && itemToDelete) {
                await reverseStockImpact(itemToDelete);
            }

            setData(data.filter((item: any) => item.id !== idToDelete));
            setEditingId(null);
        } catch (error) {
            alert('Error al eliminar');
        }
    };

    const reverseStockImpact = async (mov: InventoryMovement) => {
        const stocks = await db.getAll('stock');
        const stockEntry = stocks.find((s: ClientStock) => s.productId === mov.productId && s.warehouseId === mov.warehouseId && s.clientId === id);

        if (stockEntry) {
            const isOut = ['OUT', 'SALE'].includes(mov.type);
            const isIn = ['IN', 'HARVEST'].includes(mov.type);

            let newBalance = stockEntry.quantity;
            if (isOut) newBalance += parseFloat(String(mov.quantity));
            if (isIn) newBalance -= parseFloat(String(mov.quantity));

            await db.put('stock', { ...stockEntry, quantity: newBalance, updatedAt: new Date().toISOString(), synced: false });
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.deltaY === 0) return;
        const container = e.currentTarget;
        if (container.scrollWidth > container.clientWidth) {
            e.preventDefault();
            container.scrollLeft += e.deltaY;
        }
    };

    const filteredData = useMemo(() => {
        let items = data;

        // Search
        if (searchTerm) {
            items = items.filter((item: any) => JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase()));
        }

        // Stock Specific Filter
        if (activeStore === 'stock' && stockFilter !== 'ALL') {
            items = items.filter((s: any) => {
                const prod = lookups.products.find((p: any) => p.id === s.productId);
                if (!prod) return true;
                if (stockFilter === 'GRANOS') return prod.type === 'GRAIN';
                return prod.type !== 'GRAIN';
            });
        }

        return items;
    }, [data, searchTerm, activeStore, stockFilter, lookups.products]);

    // Grouping Logic for Render
    const groupedData = useMemo(() => {
        if (activeStore === 'stock') {
            // Group by Warehouse
            const groups: Record<string, any[]> = {};
            filteredData.forEach((item: any) => {
                const whId = item.warehouseId || 'no-warehouse';
                if (!groups[whId]) groups[whId] = [];
                groups[whId].push(item);
            });
            return groups;
        }
        if (activeStore === 'lotes') {
            // Group by Campaign (newest first)
            const groups: Record<string, any[]> = {};
            // For now, let's group lots based on their campaigns. 
            // If they don't have one, use a "Sin Campaña" group.
            lookups.campaigns.sort((a: any, b: any) => (b.name || '').localeCompare(a.name || '')).forEach((c: any) => {
                groups[c.id] = filteredData.filter((l: any) => l.campaignId === c.id);
            });
            groups['other'] = filteredData.filter((l: any) => !l.campaignId);
            return groups;
        }
        return null;
    }, [activeStore, filteredData, lookups.campaigns]);

    if (authLoading || (!isMaster && role !== 'ADMIN')) {
        return <div className="p-8 text-center text-slate-400 font-medium">Verificando permisos...</div>;
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-6 min-h-screen bg-slate-50 font-sans">
            <div className="flex flex-col gap-4">
                <div>
                    <Link href={`/clients/${id}`} className="text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center gap-1 mb-1">
                        ← Volver a Dashboard
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tablas Base</h1>
                </div>

                <div className="flex justify-between items-center">
                    <div>
                        {activeStore === 'stock' && (
                            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 w-fit">
                                {(['ALL', 'INSUMOS', 'GRANOS'] as const).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setStockFilter(f)}
                                        className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${stockFilter === f
                                            ? 'bg-white text-emerald-600 shadow-sm'
                                            : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                    >
                                        {f === 'ALL' ? 'Todo' : f === 'INSUMOS' ? 'Insumos' : 'Granos'}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3 items-center">
                        <Input
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-48 bg-white"
                        />
                        <Button onClick={loadData} variant="outline" size="sm" className="bg-white">Refrescar</Button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
                {(['stock', 'movements', 'lotes', 'money'] as EntityStore[]).map(store => (
                    <button
                        key={store}
                        onClick={() => { setActiveStore(store); setEditingId(null); }}
                        className={`px-8 py-3 text-sm font-bold border-b-2 transition-all capitalize ${activeStore === store
                            ? 'border-emerald-600 text-emerald-600 bg-emerald-50/20'
                            : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                            }`}
                    >
                        {store === 'movements' ? 'Movimientos' :
                            store === 'stock' ? 'Stock (Saldos)' :
                                store === 'lotes' ? 'Planilla de Lotes' : 'Caja (Dinero)'}
                    </button>
                ))}
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div
                    className="overflow-x-auto max-h-[75vh]"
                    onWheel={handleWheel}
                >
                    <table className="w-full text-left text-sm border-collapse min-w-[1200px]">
                        <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                            <tr>
                                {getColumns(activeStore).map(col => (
                                    <th key={col.key} className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                                        {col.label}
                                    </th>
                                ))}
                                <th className="px-4 py-3 font-semibold text-slate-900 w-16 text-center bg-slate-50 border-l border-slate-200">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={10} className="py-20 text-center text-slate-400">Cargando datos...</td></tr>
                            ) : filteredData.length === 0 ? (
                                <tr><td colSpan={10} className="py-20 text-center text-slate-400 text-xs italic">No se encontraron registros.</td></tr>
                            ) : groupedData ? (
                                // Render Grouped Rows (Stock/Lotes)
                                Object.entries(groupedData).map(([groupId, items]) => {
                                    if (items.length === 0) return null;
                                    const groupLabel = getGroupLabel(activeStore, groupId, lookups);
                                    return (
                                        <React.Fragment key={groupId}>
                                            <tr className="bg-slate-50/80 border-y border-slate-200">
                                                <td colSpan={10} className="px-4 py-2 text-[11px] font-black uppercase tracking-[0.1em] text-slate-500 bg-slate-100/50">
                                                    {groupLabel}
                                                </td>
                                            </tr>
                                            {items.map(item => <Row key={item.id} item={item} activeStore={activeStore} editingId={editingId} editValues={editValues} setEditValues={setEditValues} handleSave={handleSave} setEditingId={setEditingId} handleDelete={handleDelete} handleEdit={handleEdit} lookups={lookups} />)}
                                        </React.Fragment>
                                    );
                                })
                            ) : (
                                // Render Flat Rows (Movements/Money)
                                filteredData.map(item => <Row key={item.id} item={item} activeStore={activeStore} editingId={editingId} editValues={editValues} setEditValues={setEditValues} handleSave={handleSave} setEditingId={setEditingId} handleDelete={handleDelete} handleEdit={handleEdit} lookups={lookups} />)
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <p className="text-[10px] text-slate-400 text-center uppercase tracking-[0.2em] font-medium py-4">
                Uso administrativo exclusivo
            </p>
        </div>
    );
}

// Subcomponent for each row to keep the main component cleaner
function Row({ item, activeStore, editingId, editValues, setEditValues, handleSave, setEditingId, handleDelete, handleEdit, lookups }: any) {
    const isEditing = editingId === item.id;
    const columns: any[] = getColumns(activeStore);

    return (
        <tr className="hover:bg-slate-50/50 transition-colors group">
            {columns.map(col => (
                <td key={col.key} className="px-4 py-2 text-slate-600">
                    {isEditing && !col.readOnly ? (
                        <input
                            className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 outline-none text-sm bg-slate-50 font-medium"
                            value={editValues[col.key] || ''}
                            onChange={(e) => setEditValues({ ...editValues, [col.key]: e.target.value })}
                        />
                    ) : (
                        <div className={`whitespace-nowrap ${col.readOnly ? 'text-slate-300 font-normal italic' : 'font-medium text-slate-700'}`}>
                            {renderCell(col.key, item, lookups)}
                        </div>
                    )}
                </td>
            ))}
            <td className="px-4 py-2 text-center whitespace-nowrap bg-white group-hover:bg-slate-50 border-l border-slate-100">
                {isEditing ? (
                    <div className="flex gap-2 justify-center">
                        <button onClick={handleSave} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-all" title="Guardar">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all" title="Cancelar">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all" title="Eliminar">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-1 justify-center">
                        <button onClick={() => handleEdit(item)} className="p-1.5 text-slate-300 hover:text-slate-500 hover:bg-slate-100 rounded-full transition-all" title="Editar row">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                        </button>
                    </div>
                )}
            </td>
        </tr>
    );
}

// Standard column definitions for each tab
function getColumns(store: EntityStore) {
    switch (store) {
        case 'stock':
            return [
                { key: 'productId', label: 'Ingrediente Activo' },
                { key: 'commercialName', label: 'Nombre Comercial' },
                { key: 'brandName', label: 'Marca' },
                { key: 'quantity', label: 'Saldo Total' },
                { key: 'unit', label: 'Unidad' },
                { key: 'presentationLabel', label: 'Envase' },
                { key: 'presentationContent', label: 'Contenido' },
                { key: 'presentationAmount', label: 'Cant. Envases' }
            ];
        case 'movements':
            return [
                { key: 'date', label: 'Fecha' },
                { key: 'type', label: 'Tipo' },
                { key: 'productId', label: 'Producto' },
                { key: 'quantity', label: 'Cantidad' },
                { key: 'unit', label: 'Unidad' },
                { key: 'salePrice', label: 'Precio Venta' },
                { key: 'purchasePrice', label: 'Precio Compra' },
                { key: 'sellerName', label: 'Proveedor/Destino' },
                { key: 'notes', label: 'Notas' }
            ];
        case 'lotes':
            return [
                { key: 'name', label: 'Lote' },
                { key: 'farmId', label: 'Campo' },
                { key: 'hectares', label: 'Hectáreas' },
                { key: 'cropSpecies', label: 'Cultivo' },
                { key: 'sowingDate', label: 'Siembra' },
                { key: 'harvestDate', label: 'Cosecha' },
                { key: 'displayYield', label: 'Rinde' }
            ];
        case 'money':
            return [
                { key: 'date', label: 'Fecha' },
                { key: 'concept', label: 'Concepto' },
                { key: 'category', label: 'Rubro' },
                { key: 'amount', label: 'Monto USD' },
                { key: 'detail', label: 'Detalle' }
            ];
        default:
            return [];
    }
}

function getGroupLabel(store: EntityStore, id: string, lookups: any) {
    if (store === 'stock') {
        const wh = lookups.warehouses.find((w: any) => w.id === id);
        return wh ? wh.name : 'Sin Galpón';
    }
    if (store === 'lotes') {
        const camp = lookups.campaigns.find((c: any) => c.id === id);
        return camp ? `Campaña ${camp.name}` : 'Sin Campaña';
    }
    return id;
}

function renderCell(key: string, item: any, lookups: any) {
    const value = item[key];
    if (value === undefined || value === null) return '-';

    // Monetary styling
    if (key === 'amount') {
        const isNegative = value < 0;
        return (
            <span className={`font-mono font-bold ${isNegative ? 'text-red-500' : 'text-emerald-600'}`}>
                {isNegative ? '-' : '+'} USD {Math.abs(value).toLocaleString()}
            </span>
        );
    }

    // Resolve IDs
    if (key === 'productId') {
        const p = lookups.products.find((p: any) => p.id === value);
        return p ? p.name : <span className="text-[10px] text-slate-300 font-mono">{String(value).slice(0, 8)}</span>;
    }
    if (key === 'commercialName') {
        const p = lookups.products.find((p: any) => p.id === item.productId);
        return p?.commercialName || '-';
    }
    if (key === 'brandName') {
        const p = lookups.products.find((p: any) => p.id === item.productId);
        return p?.brandName || '-';
    }
    if (key === 'farmId') {
        const f = lookups.farms.find((f: any) => f.id === value);
        return f ? f.name : <span className="text-slate-300 font-mono text-[10px]">{String(value).slice(0, 8)}</span>;
    }

    if (key === 'sowingDate' || key === 'harvestDate') {
        if (value === '-') return '-';
        try {
            const d = new Date(value);
            return d.toLocaleDateString();
        } catch { return String(value); }
    }

    if (key === 'displayYield' && value !== '-') {
        return <span className="font-mono font-bold text-slate-800">{Number(value).toFixed(0)} kg/ha</span>;
    }

    if (key === 'type') {
        const labels: any = { IN: 'Entrada', OUT: 'Egreso', SALE: 'Venta', HARVEST: 'Cosecha' };
        return labels[value] || value;
    }

    if (key === 'date') {
        try {
            const d = new Date(value);
            return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch { return String(value); }
    }

    return String(value);
}

// React for fragments
import React from 'react';
