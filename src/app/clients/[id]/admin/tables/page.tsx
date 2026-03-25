'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { db } from '@/services/db';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useHorizontalScroll } from '@/hooks/useHorizontalScroll';
import Link from 'next/link';
import { normalizeNumber } from '@/lib/numbers';
import { generateId } from '@/lib/uuid';
import { Product, Warehouse, InventoryMovement, ClientStock, Lot, Order, Campaign } from '@/types';

type EntityStore = 'stock' | 'movements' | 'lotes' | 'money';

export default function BaseTableEditor({ params }: { params: Promise<{ id: string }> }) {
    const [movementsLimit, setMovementsLimit] = useState(10);
    const [lotesLimit, setLotesLimit] = useState(10);
    const [moneyLimit, setMoneyLimit] = useState(10);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const { id } = use(params);
    const { role, isMaster, loading: authLoading } = useAuth();
    const router = useRouter();
    const scrollRef = useHorizontalScroll();
    const [activeStore, setActiveStore] = useState<EntityStore>('stock');
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<any>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [alertMessage, setAlertMessage] = useState<string | null>(null);
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

    const showAlert = (msg: string) => {
        setAlertMessage(msg);
        setTimeout(() => setAlertMessage(null), 3500);
    };

    // Filters for Stock
    const [stockFilter, setStockFilter] = useState<'ALL' | 'INSUMOS' | 'GRANOS'>('ALL');

    useEffect(() => {
        if (!authLoading && role !== 'ADMIN' && !isMaster) {
            router.push(`/clients/${id}`);
        }
    }, [role, isMaster, authLoading, router, id]);

    useEffect(() => {
        loadLookups();
    }, [id]);

    useEffect(() => {
        if (lookups.products.length > 0 || activeStore !== 'stock') {
            loadData();
        }
    }, [activeStore, id, lookups.products.length]);

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
                const allStock = await db.getAll('stock');
                const clientStock = allStock.filter((s: ClientStock) => s.clientId === id);
                
                // Mirror Galpón enrichment logic
                const enrichedStock = clientStock.map((item: any) => {
                    const p = lookups.products.find((p: any) => p.id === item.productId);
                    const isHarvest = item.source === 'HARVEST' || p?.type === 'GRAIN' || p?.type === 'SEED';
                    
                    // Logic: 
                    // 1. Prefer Catalog metadata if available (for purchased goods)
                    // 2. For harvest/grains: Brand = Campaign Name, CommName = "Propia"
                    // 3. Fallback to item stored metadata if catalog is missing
                    
                    let resolvedBrand = item.productBrand || p?.brandName || '';
                    let resolvedCommName = p?.commercialName || item.productCommercialName || '';

                    if (isHarvest) {
                        const campaign = lookups.campaigns.find((c: any) => c.id === item.campaignId);
                        resolvedBrand = campaign?.name || resolvedBrand || '';
                        resolvedCommName = 'Propia';
                    } else if (p) {
                        // For purchased goods, catalog is law if it has data
                        resolvedBrand = p.brandName || resolvedBrand;
                        resolvedCommName = p.commercialName || resolvedCommName;
                    }

                    return {
                        ...item,
                        productName: p ? p.name : 'Desconocido',
                        productBrand: resolvedBrand,
                        productCommercialName: resolvedCommName,
                        _catalogBrand: p?.brandName,
                        _catalogCommName: p?.commercialName
                    };
                });

                setData(enrichedStock);
            } else if (activeStore === 'movements') {
                const all = await db.getAll('movements');
                const filtered = all.filter((m: any) => m.clientId === id && !m.deleted);
                setData(filtered.sort((a: any, b: any) => b.date.localeCompare(a.date)));
            } else if (activeStore === 'lotes') {
                const [lots, orders, movs] = await Promise.all([
                    db.getAll('lots'),
                    db.getAll('orders'),
                    db.getAll('movements')
                ]);

                const clientLots = lots.filter((l: any) => {
                    if (l.deleted) return false;
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

                const clientMovs = movs.filter((m: any) => m.clientId === id && !m.deleted);
                const clientOrders = orders.filter((o: any) => o.clientId === id && !o.deleted);

                // Transform into Ledger rows
                const ledger: any[] = [];

                // Add Movements (Purchases/Sales)
                clientMovs.forEach((m: any) => {
                    const isTransfer = m.notes?.toLowerCase().includes('transfer') || m.notes?.toLowerCase().includes('traslado');
                    if (isTransfer) return;

                    if (m.type === 'IN') {
                        // Use m.amount if available (newly saved), otherwise sum items or fallback to root price
                        const totalValue = m.amount || (m.items && m.items.length > 0
                            ? m.items.reduce((acc: number, it: any) => {
                                const q = parseFloat(it.quantity?.toString().replace(',', '.') || '0');
                                const p = parseFloat(it.price?.toString().replace(',', '.') || '0');
                                return acc + (q * p);
                            }, 0)
                            : (m.quantity * (m.purchasePrice || 0)));

                        const detail = (m.items && m.items.length > 1)
                            ? `${m.items.length} items (${m.items.map((it: any) => it.productName).slice(0, 2).join(', ')}${m.items.length > 2 ? '...' : ''})`
                            : `${m.quantity} ${m.unit} @ USD ${m.purchasePrice || 0}`;

                        ledger.push({
                            id: m.id,
                            sourceId: m.id,
                            sourceStore: 'movements',
                            date: m.date,
                            concept: `Compra: ${m.productName || 'Insumo'}`,
                            category: 'INSUMO',
                            amount: -totalValue,
                            detail: detail,
                            items: m.items // Pass items for breakdown view
                        });
                    } else if (m.type === 'SALE') {
                        const totalValue = m.amount || (m.quantity * (m.salePrice || 0));
                        ledger.push({
                            id: m.id,
                            sourceId: m.id,
                            sourceStore: 'movements',
                            date: m.date,
                            concept: `Venta: ${m.productName || 'Grano'}`,
                            category: 'VENTA',
                            amount: totalValue,
                            detail: `${m.quantity} ${m.unit} @ USD ${m.salePrice || 0}`,
                            items: m.items // Sales can also have items if we ever expand them
                        });
                    }
                });

                // Add Contractor Costs (from Orders)
                clientOrders.forEach((o: any) => {
                    if (o.servicePrice && o.servicePrice > 0) {
                        ledger.push({
                            id: `${o.id}-labor`,
                            sourceId: o.id,
                            sourceStore: 'orders',
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
            setIsAdding(false);
        }
    }

    const handleAddNew = () => {
        if (isAdding) return;
        const newId = 'new-' + generateId();
        const newItem: any = {
            id: newId,
            clientId: id,
            date: new Date().toISOString().slice(0, 16), // Format for datetime-local
            updatedAt: new Date().toISOString(),
            synced: false
        };

        if (activeStore === 'movements') {
            newItem.type = 'HARVEST';
            newItem.quantity = '';
            newItem.productId = lookups.products[0]?.id || '';
            newItem.warehouseId = lookups.warehouses[0]?.id || '';
            newItem.campaignId = lookups.campaigns[0]?.id || '';
        }

        setData([newItem, ...data]);
        setEditingId(newId);
        setEditValues(newItem);
        setIsAdding(true);
    };

    const handleEdit = (item: any) => {
        setEditingId(item.id);
        setEditValues({ ...item });
    };

    const handleSave = async () => {
        if (!editingId) return;

        try {
            setLoading(true);
            const isNew = String(editingId).startsWith('new-');
            const originalItem = isNew ? null : data.find((item: any) => item.id === editingId);

            const updatedItem = {
                ...editValues,
                id: isNew ? generateId() : editingId,
                quantity: normalizeNumber(editValues.quantity),
                purchasePrice: normalizeNumber(editValues.purchasePrice),
                salePrice: normalizeNumber(editValues.salePrice),
                amount: normalizeNumber(editValues.amount),
                updatedAt: new Date().toISOString(),
                synced: false
            };

            // Ensure clientId is present
            if (!updatedItem.clientId) updatedItem.clientId = id;

            let storeToUpdate: any = activeStore;
            if (activeStore === 'money') storeToUpdate = 'movements';

            await db.put(storeToUpdate, updatedItem);

            if (storeToUpdate === 'movements') {
                if (isNew) {
                    // Impact as if it went from 0 to new quantity
                    const dummyOld = { ...updatedItem, quantity: 0 };
                    await adjustStockForMovementEdit(dummyOld, updatedItem);
                } else if (originalItem) {
                    await adjustStockForMovementEdit(originalItem, updatedItem);
                }
            }

            if (isNew) {
                // Refresh data to get clean IDs and updated stock
                await loadData();
            } else {
                setData(data.map((item: any) => item.id === editingId ? updatedItem : item));
            }

            setEditingId(null);
            setEditValues({});
            setIsAdding(false);
            showAlert('Registro guardado exitosamente!');
        } catch (error) {
            alert('Error al guardar los cambios');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        if (isAdding) {
            setData(data.filter(i => i.id !== editingId));
            setIsAdding(false);
        }
        setEditingId(null);
        setEditValues({});
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
            if (!itemToDelete) return;

            let storeToDelete: any = activeStore;
            let finalIdToDelete = idToDelete;

            if (activeStore === 'money' && itemToDelete.sourceStore) {
                storeToDelete = itemToDelete.sourceStore;
                finalIdToDelete = itemToDelete.sourceId;
            } else if (activeStore === 'money') {
                storeToDelete = 'movements'; // Fallback
            }

            // Use soft delete for movements/orders to support sync and filtering
            if (storeToDelete === 'movements' || storeToDelete === 'orders' || storeToDelete === 'lots') {
                const targetItem = await db.get(storeToDelete, finalIdToDelete);
                if (targetItem) {
                    await db.put(storeToDelete, {
                        ...targetItem,
                        deleted: true,
                        updatedAt: new Date().toISOString(),
                        synced: false
                    });
                }
            } else {
                await db.delete(storeToDelete, finalIdToDelete);
            }

            if (storeToDelete === 'movements' && itemToDelete) {
                await reverseStockImpact(itemToDelete);
            }

            setData(data.filter((item: any) => item.id !== idToDelete));
            setEditingId(null);
            showAlert('Registro eliminado exitosamente!');
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
            
            // Apply slice to lotes here
            const visibleLotes = filteredData.slice(0, lotesLimit);

            lookups.campaigns.sort((a: any, b: any) => (b.name || '').localeCompare(a.name || '')).forEach((c: any) => {
                groups[c.id] = visibleLotes.filter((l: any) => l.campaignId === c.id);
            });
            groups['other'] = visibleLotes.filter((l: any) => !l.campaignId);
            return groups;
        }
        return null;
    }, [activeStore, filteredData, lookups.campaigns]);

    if (authLoading || (!isMaster && role !== 'ADMIN')) {
        return <div className="p-8 text-center text-slate-400 font-medium">Verificando permisos...</div>;
    }

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            <div className="flex-none p-6 pb-0">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-6">
                        <Link href={`/clients/${id}`} className="text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center gap-1">
                            ← Volver a Dashboard
                        </Link>
                        <h1 className="text-2xl font-bold text-slate-800">Tablas Base</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <Input
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-64"
                        />
                        <Button
                            onClick={handleAddNew}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Nuevo Registro
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => { loadData(); loadLookups(); }}
                            className="text-slate-600 border-slate-200"
                        >
                            Refrescar
                        </Button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200">
                    {(['stock', 'movements', 'lotes', 'money'] as EntityStore[]).map(store => (
                        <button
                            key={store}
                            onClick={() => { setActiveStore(store); setEditingId(null); setIsAdding(false); }}
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
            </div>

            {/* Table Container */}
            {/* Rest of the UI */}
            {alertMessage && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] animate-bounceIn">
                    <div className="bg-white border-2 border-emerald-500 text-emerald-800 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
                        <span className="text-xl">💡</span>
                        <p className="font-bold text-sm uppercase tracking-wide">{alertMessage}</p>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-hidden p-6 pt-2">
                <div
                    ref={scrollRef as any}
                    className="h-full border border-slate-200 rounded-xl bg-white shadow-sm overflow-auto"
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
                                    
                                    // Apply limit for Lotes grouped view if needed? 
                                    // Actually for 'lotes', the grouping logic uses 'filteredData' which we will slice next.
                                    return (
                                        <React.Fragment key={groupId}>
                                            <tr className="bg-slate-50/80 border-y border-slate-200">
                                                <td colSpan={10} className="px-4 py-2 text-[11px] font-black uppercase tracking-[0.1em] text-slate-500 bg-slate-100/50">
                                                    {groupLabel}
                                                </td>
                                            </tr>
                                            {items.map(item => <Row key={item.id} item={item} activeStore={activeStore} editingId={editingId} editValues={editValues} setEditValues={setEditValues} handleSave={handleSave} handleCancel={handleCancel} setEditingId={setEditingId} handleDelete={handleDelete} handleEdit={handleEdit} lookups={lookups} expandedId={expandedId} setExpandedId={setExpandedId} showAlert={showAlert} />)}
                                        </React.Fragment>
                                    );
                                })
                            ) : (
                                // Render Flat Rows (Movements/Money)
                                (() => {
                                    const limit = activeStore === 'movements' ? movementsLimit : moneyLimit;
                                    return filteredData.slice(0, limit).map(item => (
                                        <Row key={item.id} item={item} activeStore={activeStore} editingId={editingId} editValues={editValues} setEditValues={setEditValues} handleSave={handleSave} handleCancel={handleCancel} setEditingId={setEditingId} handleDelete={handleDelete} handleEdit={handleEdit} lookups={lookups} expandedId={expandedId} setExpandedId={setExpandedId} showAlert={showAlert} />
                                    ));
                                })()
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination Footer */}
                {activeStore !== 'stock' && (
                    <div className="mt-0 border-x border-b border-slate-200 rounded-b-xl overflow-hidden flex bg-slate-50 divide-x divide-slate-200">
                        {(() => {
                            const limit = activeStore === 'movements' ? movementsLimit : activeStore === 'lotes' ? lotesLimit : moneyLimit;
                            const setLimit = activeStore === 'movements' ? setMovementsLimit : activeStore === 'lotes' ? setLotesLimit : setMoneyLimit;
                            const hasMore = filteredData.length > limit;
                            
                            if (!hasMore && limit <= 10) return null;

                            return (
                                <>
                                    {hasMore && (
                                        <button 
                                            onClick={() => setLimit(prev => prev + 20)}
                                            className="flex-1 py-3 hover:bg-slate-100 active:bg-slate-200 transition-colors flex items-center justify-center gap-2 group"
                                        >
                                            <span className="text-[11px] font-black text-emerald-600 uppercase tracking-widest group-hover:scale-105 transition-transform">
                                                Cargar 20 más
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-medium">
                                                ({filteredData.length - limit} restantes)
                                            </span>
                                        </button>
                                    )}
                                    {limit > 10 && (
                                        <button 
                                            onClick={() => setLimit(10)}
                                            className="flex-1 py-3 hover:bg-red-50 active:bg-red-100 transition-colors flex items-center justify-center gap-2 group border-l border-slate-200"
                                        >
                                            <span className="text-[11px] font-black text-slate-400 group-hover:text-red-500 uppercase tracking-widest transition-colors">
                                                Ver menos
                                            </span>
                                        </button>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                )}
            </div>
            <p className="text-[10px] text-slate-400 text-center uppercase tracking-[0.2em] font-medium py-4">
                Uso administrativo exclusivo
            </p>
        </div>
    );
}

// Subcomponent for each row to keep the main component cleaner
function Row({ item, activeStore, editingId, editValues, setEditValues, handleSave, handleCancel, handleDelete, handleEdit, lookups, expandedId, setExpandedId, showAlert }: any) {
    const isEditing = editingId === item.id;
    const columns: any[] = getColumns(activeStore);
    const hasItems = item.items && item.items.length > 0;
    const isExpanded = expandedId === item.id;

    const toggleExpand = () => {
        if (!hasItems || activeStore !== 'money' || isEditing) return;
        setExpandedId(isExpanded ? null : item.id);
    };

    return (
        <React.Fragment>
            <tr 
                onClick={toggleExpand}
                className={`transition-colors group ${isEditing ? 'bg-emerald-50/10' : (hasItems && activeStore === 'money' ? 'cursor-pointer hover:bg-slate-50' : 'hover:bg-slate-50/50')}`}
            >
                {columns.map(col => (
                    <td key={col.key} className="px-4 py-2 text-slate-600">
                        <div className="flex items-center gap-2">
                             {col.key === 'concept' && hasItems && activeStore === 'money' && (
                                 <span className={`text-[10px] transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                             )}
                             {renderCell(col.key, item, lookups, activeStore, isEditing, editValues, setEditValues, showAlert)}
                        </div>
                    </td>
                ))}
                <td className="px-4 py-2 text-center whitespace-nowrap bg-white group-hover:bg-slate-50 border-l border-slate-100">
                    {isEditing ? (
                        <div className="flex gap-2 justify-center">
                            <button onClick={(e) => { e.stopPropagation(); handleSave(); }} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-all" title="Guardar">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleCancel(); }} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all" title="Cancelar">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all" title="Eliminar">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-1 justify-center">
                            <button onClick={(e) => { e.stopPropagation(); handleEdit(item); }} className="p-1.5 text-slate-300 hover:text-slate-500 hover:bg-slate-100 rounded-full transition-all" title="Editar row">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                            </button>
                        </div>
                    )}
                </td>
            </tr>
            {isExpanded && hasItems && activeStore === 'money' && (
                <tr className="bg-slate-50/50 border-y border-slate-200/50">
                    <td colSpan={columns.length + 1} className="p-0">
                        <div className="px-12 py-3 bg-slate-50/30">
                             <table className="w-full text-[11px] border-collapse">
                                 <thead>
                                     <tr className="text-slate-400 font-black uppercase tracking-widest border-b border-slate-200">
                                         <th className="text-left pb-2 font-black">Producto</th>
                                         <th className="text-left pb-2 font-black">Marca</th>
                                         <th className="text-right pb-2 font-black">Cantidad</th>
                                         <th className="text-right pb-2 font-black">Precio Unit.</th>
                                         <th className="text-right pb-2 font-black">Subtotal</th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-100">
                                     {item.items.map((it: any, i: number) => {
                                         const q = parseFloat(it.quantity?.toString().replace(',', '.') || '0');
                                         const p = parseFloat(it.price?.toString().replace(',', '.') || '0');
                                         return (
                                             <tr key={i} className="text-slate-600">
                                                 <td className="py-2 pr-4 font-bold text-slate-700">↳ {it.productName}</td>
                                                 <td className="py-2 pr-4 text-slate-400 font-medium uppercase">{it.productBrand || '-'}</td>
                                                 <td className="py-2 text-right font-mono font-bold">{q.toLocaleString()} {it.unit}</td>
                                                 <td className="py-2 text-right font-mono text-slate-400">USD {p.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                 <td className="py-2 text-right font-mono font-bold text-slate-900">USD {(q * p).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                             </tr>
                                         );
                                     })}
                                 </tbody>
                             </table>
                        </div>
                    </td>
                </tr>
            )}
        </React.Fragment>
    );
}

// Standard column definitions for each tab
function getColumns(store: EntityStore) {
    switch (store) {
        case 'stock':
            return [
                { key: 'productId', label: 'Ingrediente Activo' },
                { key: 'productCommercialName', label: 'Nombre Comercial' },
                { key: 'productBrand', label: 'Marca' },
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
                { key: 'warehouseId', label: 'Galpón' },
                { key: 'campaignId', label: 'Campaña' },
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

function renderCell(key: string, item: any, lookups: any, activeStore: string, isEditing?: boolean, editValues?: any, setEditValues?: any, showAlert?: (msg: string) => void) {
    const value = isEditing ? editValues[key] : item[key];

    if (isEditing) {
        const handleMetadataEdit = (key: string, val: string) => {
            if (activeStore === 'stock') {
                const isCatalogOverride = (key === 'productCommercialName' && !!item._catalogCommName) || 
                                         (key === 'productBrand' && !!item._catalogBrand);
                
                if (isCatalogOverride) {
                    showAlert?.("Cambie esto en el catálogo de productos para mantener la consistencia.");
                    return;
                }
            }
            setEditValues({ ...editValues, [key]: val });
        };

        const handleQuantityEdit = (val: string) => {
            if (activeStore === 'stock') {
                showAlert?.("Para mantener la trazabilidad, cambie los kg en el Historial de Movimientos.");
                return;
            }
            setEditValues({ ...editValues, quantity: val });
        };

        if (key === 'productId') {
            return (
                <select 
                    className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 outline-none text-sm bg-white"
                    value={value || ''}
                    onChange={(e) => setEditValues({ ...editValues, [key]: e.target.value })}
                >
                    <option value="">Seleccionar...</option>
                    {lookups.products.sort((a: any, b: any) => a.name.localeCompare(b.name)).map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            );
        }
        if (key === 'warehouseId') {
            return (
                <select 
                    className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 outline-none text-sm bg-white"
                    value={value || ''}
                    onChange={(e) => setEditValues({ ...editValues, [key]: e.target.value })}
                >
                    <option value="">Seleccionar...</option>
                    {lookups.warehouses.map((w: any) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                </select>
            );
        }
        if (key === 'campaignId') {
            return (
                <select 
                    className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 outline-none text-sm bg-white"
                    value={value || ''}
                    onChange={(e) => setEditValues({ ...editValues, [key]: e.target.value })}
                >
                    <option value="">Seleccionar...</option>
                    {lookups.campaigns.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            );
        }
        if (key === 'type' && (editValues.id === 'new' || String(editValues.id).startsWith('new-'))) {
            return (
                <select 
                    className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 outline-none text-sm bg-white"
                    value={value || ''}
                    onChange={(e) => setEditValues({ ...editValues, [key]: e.target.value })}
                >
                    <option value="IN">Entrada</option>
                    <option value="OUT">Egreso</option>
                    <option value="SALE">Venta</option>
                    <option value="HARVEST">Cosecha</option>
                </select>
            );
        }

        if (key === 'date') {
            return (
                <input 
                    type="datetime-local"
                    className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 outline-none text-sm bg-white"
                    value={value?.slice(0, 16) || ''}
                    onChange={(e) => setEditValues({ ...editValues, [key]: e.target.value })}
                />
            );
        }

        if (key === 'quantity') {
            return (
                <input
                    className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 outline-none text-sm bg-white font-medium shadow-sm"
                    value={value || ''}
                    onChange={(e) => handleQuantityEdit(e.target.value)}
                    onFocus={() => activeStore === 'stock' && handleQuantityEdit('')}
                />
            );
        }

        if (key === 'productCommercialName' || key === 'productBrand' || key === 'commercialName' || key === 'brandName') {
            return (
                <input
                    className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 outline-none text-sm bg-slate-50 font-medium cursor-not-allowed"
                    value={value || ''}
                    readOnly
                    onClick={() => handleMetadataEdit(key, '')}
                />
            );
        }

        return (
            <input
                className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 outline-none text-sm bg-white font-medium shadow-sm"
                value={value || ''}
                readOnly={activeStore !== 'stock' && (key === 'commercialName' || key === 'brandName' || key === 'unit')}
                onChange={(e) => setEditValues({ ...editValues, [key]: e.target.value })}
            />
        );
    }

    // Resolve IDs and specific formatting that should run even if value is null/undefined
    if (key === 'productId') {
        const val = isEditing ? editValues[key] : (value || item.productId);
        const p = lookups.products.find((p: any) => p.id === val);
        return p ? p.name : <span className="text-[10px] text-slate-300 font-mono">{String(val || '-').slice(0, 8)}</span>;
    }

    if (key === 'productCommercialName' || key === 'commercialName') {
        const val = isEditing ? editValues[key] : (item.productCommercialName || item.commercialName);
        if (val && val !== '-' && val !== '') return val;
        
        const p = lookups.products.find((p: any) => p.id === item.productId);
        if (p?.commercialName) return p.commercialName;
        if (item.source === 'HARVEST' || (p?.type === 'GRAIN' || p?.type === 'SEED')) return 'Propia';
        if (item.productBrand === 'propia' || item.brandName === 'propia') return 'Propia';
        return val || '-';
    }

    if (key === 'productBrand' || key === 'brandName') {
        const val = isEditing ? editValues[key] : (item.productBrand || item.brandName);
        if (val && val !== '-' && val !== '') return val;
        
        const p = lookups.products.find((p: any) => p.id === item.productId);
        if (p?.brandName) return p.brandName;
        if (item.source === 'HARVEST' || (p?.type === 'GRAIN' || p?.type === 'SEED')) {
            const campaign = lookups.campaigns.find((c: any) => c.id === item.campaignId);
            return campaign ? campaign.name : '-';
        }
        return val || '-';
    }

    if (key === 'unit') {
        if (isEditing) return editValues[key] || '-';
        const p = lookups.products.find((p: any) => p.id === item.productId);
        return item.unit || p?.unit || '-';
    }

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

    if (key === 'farmId') {
        const f = lookups.farms.find((f: any) => f.id === value);
        return f ? f.name : <span className="text-slate-300 font-mono text-[10px]">{String(value).slice(0, 8)}</span>;
    }
    if (key === 'warehouseId') {
        const w = lookups.warehouses.find((w: any) => w.id === value);
        return w ? w.name : <span className="text-slate-300 font-mono text-[10px]">{String(value).slice(0, 8)}</span>;
    }
    if (key === 'campaignId') {
        const c = lookups.campaigns.find((c: any) => c.id === value);
        return c ? c.name : <span className="text-slate-300 font-mono text-[10px]">{String(value).slice(0, 8)}</span>;
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

    if (key === 'unit') {
        if (value && value !== '-') return value;
        const p = lookups.products.find((p: any) => p.id === item.productId);
        return p?.unit || '-';
    }

    return String(value);
}

// React for fragments
import React from 'react';
