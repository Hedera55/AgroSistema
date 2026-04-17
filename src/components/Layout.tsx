'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { syncService, SyncStatus } from '@/services/sync';
import { db } from '@/services/db';
import { generateId } from '@/lib/uuid';
import { Warehouse } from '@/types';

export default function Layout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { isActive, loading, role, user, isMaster, assignedId, displayName, profile } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
    const [currentClientName, setCurrentClientName] = useState<string | null>(null);
    const [persistedClientId, setPersistedClientId] = useState<string | null>(null);
    const [assignedCompanies, setAssignedCompanies] = useState<{ id: string, name: string }[]>([]);
    const [pendingHarvests, setPendingHarvests] = useState<any[]>([]);
    const [isCosechasOpen, setIsCosechasOpen] = useState(false);
    const isInitializing = useRef(false);

    // Fetch assigned companies for Contratista
    useEffect(() => {
        if (role === 'CONTRATISTA' && assignedId) {
            db.getAllByClient('clients', assignedId).then(all => {
                const assigned = all.filter((c: any) =>
                    profile?.assigned_clients?.includes(c.id) && !c.deleted
                ).map((c: any) => ({ id: c.id, name: c.name }));
                setAssignedCompanies(assigned);
            });
        }
    }, [role, assignedId, profile?.assigned_clients]);

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!loading && !isActive && pathname !== '/login' && !pathname?.startsWith('/kml')) {
            router.push('/login');
        }
    }, [isActive, loading, pathname, router]);

    // Sync Subscription
    useEffect(() => {
        if (isActive) {
            syncService.subscribeToChanges();
            // Initial sync on load
            syncService.sync();
        }
        return () => syncService.unsubscribe();
    }, [isActive]);

    useEffect(() => {
        const unsubscribe = syncService.onStatusChange((status) => {
            setSyncStatus(status);
        });
        return unsubscribe;
    }, []);



    // Load persisted client on mount and on every navigation
    useEffect(() => {
        const handleSelectionChange = () => {
            const saved = localStorage.getItem('lastSelectedClientId');
            setPersistedClientId(saved);
        };

        handleSelectionChange(); // Initial load

        window.addEventListener('clientSelectionChanged', handleSelectionChange);
        window.addEventListener('storage', handleSelectionChange);

        return () => {
            window.removeEventListener('clientSelectionChanged', handleSelectionChange);
            window.removeEventListener('storage', handleSelectionChange);
        };
    }, []); // Empty array is safer for hot-reloads, listeners handle the updates
    // Extract clientId from URL if present (for Admin/Master view)
    const urlClientId = pathname?.match(/\/clients\/([^/]+)/)?.[1];

    // Sync persisted state with URL
    useEffect(() => {
        if (urlClientId) {
            setPersistedClientId(urlClientId);
            localStorage.setItem('lastSelectedClientId', urlClientId);
        }
    }, [urlClientId]);

    const handleDeselect = (e: React.MouseEvent) => {
        e.preventDefault();
        localStorage.removeItem('lastSelectedClientId');
        setPersistedClientId(null);
        window.dispatchEvent(new CustomEvent('clientSelectionChanged'));
    };
    // Effective Client ID for navigation context: 
    // - For CLIENT role: URL/Persisted if assigned, else assigned_clients[0].
    // - For ADMIN/MASTER: URL takes precedence, then persisted selection.
    const effectiveId = useMemo(() => {
        const potentialId = (urlClientId || (persistedClientId && persistedClientId !== 'null' ? persistedClientId : null));
        
        if (role === 'CLIENT') {
            const hasAccess = profile?.assigned_clients?.includes(potentialId || '');
            if (potentialId && hasAccess) return potentialId;
            return assignedId;
        }
        
        return potentialId;
    }, [role, assignedId, urlClientId, persistedClientId, profile?.assigned_clients]);

    // Fetch Pending Harvests for Sidebar
    useEffect(() => {
        const fetchPending = async () => {
            if (!effectiveId) {
                setPendingHarvests([]);
                return;
            }
            try {
                const farms = await db.getAllByClient('farms', effectiveId);
                const farmIds = farms.map((f: any) => f.id);
                
                const allLots = await db.getAll('lots');
                const validLots = allLots.filter((lot: any) => farmIds.includes(lot.farmId));
                
                setPendingHarvests(validLots.filter((l: any) => l.status === 'SOWED' && !l.deleted));
            } catch (err) {
                console.error('Error fetching pending harvests:', err);
            }
        };

        fetchPending();

        const handleUpdate = () => fetchPending();
        window.addEventListener('lotsUpdated', handleUpdate);
        window.addEventListener('clientSelectionChanged', handleUpdate);
        
        return () => {
            window.removeEventListener('lotsUpdated', handleUpdate);
            window.removeEventListener('clientSelectionChanged', handleUpdate);
        };
    }, [effectiveId, syncStatus]);
    // Fetch client name for display
    useEffect(() => {
        if (effectiveId) {
            db.get('clients', effectiveId).then(client => {
                if (client) setCurrentClientName(client.name);
                else setCurrentClientName(null);
            }).catch(() => setCurrentClientName(null));
        } else {
            setCurrentClientName(null);
        }
    }, [effectiveId]);
    // Phase 15: Auto-initialize warehouses for new companies (Optimized)
    useEffect(() => {
        if (!effectiveId) return;

        // Optimization: Check session storage to avoid redundant DB calls on every navigation
        const hasChecked = sessionStorage.getItem(`warehouse_init_${effectiveId}`);
        if (hasChecked) return;

        const checkAndInitWarehouses = async () => {
            try {
                // Initial check
                let clientWarehouses = await db.getAllByClient('warehouses', effectiveId);
                clientWarehouses = clientWarehouses.filter((w: Warehouse) => !w.deleted);
                
                // --- Part 1: Safe Deduplication of existing leaks ---
                const namesToCheck = ['Acopio de Granos', 'Galpón'];
                let hasChanged = false;

                for (const name of namesToCheck) {
                    const duplicates = clientWarehouses.filter((w: Warehouse) => w.name.trim().toLowerCase() === name.toLowerCase());
                    if (duplicates.length > 1) {
                        const officialId = name === 'Acopio de Granos' ? `wh-harvest-${effectiveId}` : `wh-default-${effectiveId}`;
                        // Priority: deterministic ID, else oldest one
                        const toKeep = duplicates.find((w: Warehouse) => w.id === officialId) || duplicates[0];
                        const toDelete = duplicates.filter((w: Warehouse) => w.id !== toKeep.id);

                        const allStock = await db.getAllByClient('stock', effectiveId);
                        const allMovements = await db.getAllByClient('movements', effectiveId);

                        for (const wh of toDelete) {
                            const hasStock = allStock.some((s: any) => s.warehouseId === wh.id);
                            const hasMovements = allMovements.some((m: any) => m.warehouseId === wh.id);
                            
                            if (!hasStock && !hasMovements) {
                                console.log(`🧹 Safe deduplication: Removing empty duplicate warehouse "${wh.name}" (${wh.id})`);
                                await db.put('warehouses', { ...wh, deleted: true, synced: false });
                                hasChanged = true;
                            }
                        }
                    }
                }

                if (hasChanged) {
                    clientWarehouses = (await db.getAllByClient('warehouses', effectiveId)).filter((w: Warehouse) => !w.deleted);
                    syncService.pushChanges();
                }

                // --- Part 2: Creation of missing defaults ---
                const hasHarvest = clientWarehouses.some((w: Warehouse) => w.name.trim().toLowerCase() === 'acopio de granos');
                const hasDefault = clientWarehouses.some((w: Warehouse) => w.name.trim().toLowerCase() === 'galpón');

                if ((!hasHarvest || !hasDefault) && !isInitializing.current) {
                    // Robustness: Wait a bit to let any initial sync finish
                    await new Promise(resolve => setTimeout(resolve, 800));
                    
                    // Final check before creation
                    clientWarehouses = (await db.getAllByClient('warehouses', effectiveId)).filter((w: Warehouse) => !w.deleted);
                    
                    const stillMissingHarvest = !clientWarehouses.some((w: Warehouse) => w.name.trim().toLowerCase() === 'acopio de granos');
                    const stillMissingDefault = !clientWarehouses.some((w: Warehouse) => w.name.trim().toLowerCase() === 'galpón');

                    if ((stillMissingHarvest || stillMissingDefault) && !isInitializing.current) {
                        isInitializing.current = true;
                        console.log(`🚀 Initializing missing default warehouses for company ${effectiveId}...`);
                        const now = new Date().toISOString();

                        if (stillMissingHarvest) {
                            await db.put('warehouses', {
                                id: `wh-harvest-${effectiveId}`,
                                clientId: effectiveId,
                                name: 'Acopio de Granos',
                                createdAt: now,
                                updatedAt: now,
                                synced: false,
                                deleted: false
                            });
                        }

                        if (stillMissingDefault) {
                            await db.put('warehouses', {
                                id: `wh-default-${effectiveId}`,
                                clientId: effectiveId,
                                name: 'Galpón',
                                createdAt: now,
                                updatedAt: now,
                                synced: false,
                                deleted: false
                            });
                        }

                        syncService.pushChanges();
                        console.log('✅ Default warehouses verified/created.');
                    }
                }

                // Mark as checked for this session
                sessionStorage.setItem(`warehouse_init_${effectiveId}`, 'true');
            } catch (err) {
                console.error('Error in warehouse auto-initialization/cleanup:', err);
            }
        };

        checkAndInitWarehouses();
    }, [effectiveId]);

    // Show client menu items if we have a context
    const showClientMenu = !!effectiveId;

    const navigation = useMemo(() => [
        // For Admin/Master: General Client list. Now also for CLIENT to switch companies.
        { name: 'Empresas', href: '/clients', show: isMaster || role === 'ADMIN' || role === 'CLIENT' },
        // For Master: User management
        { name: 'Usuarios', href: '/admin/users', show: isMaster },
        // For Client Context (available to all if viewing a client)
        { name: 'Galpón', href: `/clients/${effectiveId}/stock`, show: showClientMenu && role !== 'CONTRATISTA' },
        { name: 'Campos', href: `/clients/${effectiveId}/fields`, show: showClientMenu && role !== 'CONTRATISTA' },
        { name: 'Contaduría', href: `/clients/${effectiveId}/investors`, show: showClientMenu && role !== 'CONTRATISTA' },
        { name: 'Órdenes', href: role === 'CONTRATISTA' ? '/orders' : `/clients/${effectiveId}/orders`, show: role === 'CONTRATISTA' || showClientMenu },
        { name: 'GRÁFICOS', href: `/clients/${effectiveId}/analytics?tab=summary`, show: showClientMenu && role !== 'CONTRATISTA' },
    ].filter(item => item.show), [isMaster, role, effectiveId, showClientMenu]);

    // Don't show sidebar/header on login page or public context
    const isPublic = pathname === '/login' || pathname?.startsWith('/kml') || pathname?.includes('/public/map/');
    
    if (isPublic) {
        return <>{children}</>;
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar for Desktop */}
            <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white min-h-screen">
                <div className="p-6">
                    <h1 className="text-2xl font-bold text-emerald-500">
                        AgroSistema
                    </h1>
                </div>
                <nav className="flex-1 px-4 space-y-2">
                    {navigation.map((item) => {
                        const isOrders = item.name === 'Órdenes' && role === 'CONTRATISTA';
                        const hasClientSelected = isOrders && !!searchParams?.get('clientId');
                        const isMainActive = pathname === item.href && !hasClientSelected;

                        return (
                            <div key={item.name} className="space-y-1">
                                <Link
                                    href={item.href}
                                    className={`block px-4 py-3 rounded-lg transition-colors ${
                                        item.name === 'GRÁFICOS' 
                                            ? (pathname?.includes('/analytics') ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20' : 'text-slate-300 hover:bg-slate-800 hover:text-white')
                                            : (isMainActive ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-800 hover:text-white')
                                        }`}
                                >
                                    {item.name}
                                </Link>

                                {isOrders && assignedCompanies.length > 0 && (
                                    <div className="space-y-1 py-1 animate-fadeIn">
                                        {assignedCompanies.map((comp) => {
                                            const isSelected = pathname === '/orders' && searchParams?.get('clientId') === comp.id;
                                            return (
                                                <Link
                                                    key={comp.id}
                                                    href={`/orders?clientId=${comp.id}`}
                                                    className={`block px-4 py-2 text-sm font-medium transition-all truncate rounded-lg ml-2 ${isSelected 
                                                        ? 'bg-emerald-600 text-white shadow-md' 
                                                        : 'text-emerald-500 hover:text-emerald-400 hover:bg-slate-800/50'}`}
                                                >
                                                    {comp.name}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {currentClientName && showClientMenu && role !== 'CONTRATISTA' && (
                        <div className="mt-6 animate-fadeIn space-y-1">
                            <Link
                                href={`/clients/${effectiveId}`}
                                className="px-4 text-sm text-emerald-500 font-medium truncate tracking-wide hover:text-emerald-400 transition-all block mb-5"
                            >
                                {currentClientName}
                            </Link>

                            {/* Cosechas Menu Item */}
                            <div className="bg-blue-600/10 rounded-lg overflow-hidden transition-all mx-2 group">
                                <button 
                                    onClick={() => setIsCosechasOpen(!isCosechasOpen)}
                                    className="w-full pl-2 pr-4 py-2 flex flex-col justify-start transition-colors cursor-pointer"
                                >
                                    <div className="w-full flex justify-between items-center">
                                        <div className="flex items-baseline gap-2">
                                            <Link 
                                                href={`/clients/${effectiveId}/analytics?tab=evolucion`}
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-[13px] font-medium text-blue-500 tracking-wide uppercase transition-colors cursor-pointer hover:text-blue-400"
                                            >
                                                Cosechas
                                            </Link>
                                            {isCosechasOpen && (
                                                <span className="text-[10px] italic font-medium text-blue-500">
                                                    pendientes
                                                </span>
                                            )}
                                        </div>
                                        {pendingHarvests.length > 0 && (
                                            <span className="text-blue-500 text-[10px] font-bold">
                                                {pendingHarvests.length}
                                            </span>
                                        )}
                                    </div>
                                </button>

                                {isCosechasOpen && (
                                    <div className="pb-2 space-y-0.5">
                                        {pendingHarvests.length === 0 ? (
                                            <div className="pl-2 py-2 text-[10px] text-slate-500 italic">No hay cosechas pendientes</div>
                                        ) : (
                                            pendingHarvests.map((lot) => (
                                                <Link
                                                    key={lot.id}
                                                    href={`/clients/${effectiveId}/fields?harvestLotId=${lot.id}`}
                                                    className="block pl-2 py-1 text-[11px] font-medium text-blue-300/80 hover:text-white transition-all truncate"
                                                    title={lot.name}
                                                >
                                                    {lot.name}
                                                </Link>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </nav>
                <div className="p-4 border-t border-slate-800 space-y-4">
                    <Link
                        href="/profile"
                        className="flex items-center gap-3 px-4 py-2 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-all group"
                    >
                        <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold ring-emerald-500/30 group-hover:ring-4 transition-all">
                            {displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{displayName}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{role}</p>
                        </div>
                    </Link>
                    <button
                        onClick={async () => {
                            await supabase.auth.signOut();
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <span>Cerrar Sesión</span>
                    </button>
                    <button
                        onClick={() => syncService.sync()}
                        disabled={syncStatus === 'syncing'}
                        className={`w-full text-center text-[10px] uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 py-1 rounded active:scale-95 hover:brightness-110
                            ${syncStatus === 'syncing' ? 'text-emerald-500' :
                                syncStatus === 'success' ? 'text-emerald-400 font-bold' :
                                    syncStatus === 'error' ? 'text-red-400' : 'text-emerald-500 hover:text-emerald-400'}`}
                    >
                        {syncStatus === 'syncing' ? (
                            '...'
                        ) : syncStatus === 'success' ? (
                            'Sincronizado'
                        ) : syncStatus === 'error' ? (
                            <>
                                <span>❌</span>
                                Error
                            </>
                        ) : (
                            <>
                                <span className="text-xs">☁️</span>
                                Sincronizar Ahora
                            </>
                        )}
                    </button>
                </div>
            </aside >

            {/* Main Content */}
            < div className="flex-1 flex flex-col min-w-0" >
                {/* Mobile Header */}
                < header className="md:hidden bg-white shadow-sm p-4 flex justify-between items-center" >
                    <span className="font-bold text-emerald-600">AgroSistema</span>
                    <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-600">
                        Menu
                    </button>
                </header >

                {/* Mobile Menu */}
                {
                    isMobileMenuOpen && (
                        <div className="md:hidden bg-slate-900 text-white p-4 border-t border-slate-800">
                            <div className="grid grid-cols-2 gap-4">
                                {/* Left Column: Navigation */}
                                <div className="space-y-1">
                                    {navigation.map((item) => (
                                        <Link
                                            key={item.name}
                                            href={item.href}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="block py-2 text-slate-300 hover:text-white"
                                        >
                                            {item.name}
                                        </Link>
                                    ))}
                                </div>

                                {/* Right Column: Client & Cosechas */}
                                {currentClientName && showClientMenu && (
                                    <div className="space-y-4">
                                        <Link
                                            href={`/clients/${effectiveId}/analytics?tab=summary`}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="block py-2 text-slate-300 hover:text-emerald-500 font-medium border-b border-white/5"
                                        >
                                            GRÁFICOS
                                        </Link>
                                        <Link
                                            href={`/clients/${effectiveId}`}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="block py-2 text-emerald-500 font-medium truncate"
                                        >
                                            {currentClientName}
                                        </Link>

                                        {/* Mobile Cosechas Menu */}
                                        <div className="bg-blue-600/10 rounded-lg overflow-hidden transition-all -ml-2 mr-4">
                                            <button 
                                                onClick={() => setIsCosechasOpen(!isCosechasOpen)}
                                                className="w-full pl-2 pr-3 py-2 flex flex-col justify-start transition-colors cursor-pointer"
                                            >
                                                <div className="w-full flex justify-between items-center">
                                                    <div className="flex items-baseline gap-2">
                                                        <Link 
                                                            href={`/clients/${effectiveId}/analytics?tab=evolucion`}
                                                            onClick={(e) => { e.stopPropagation(); setIsMobileMenuOpen(false); }}
                                                            className="text-[12px] font-medium text-blue-500 tracking-wide uppercase transition-colors cursor-pointer hover:text-blue-400"
                                                        >
                                                            Cosechas
                                                        </Link>
                                                        {isCosechasOpen && (
                                                            <span className="text-[10px] italic font-medium text-blue-500 animate-fadeIn">
                                                                pendientes
                                                            </span>
                                                        )}
                                                    </div>
                                                    {pendingHarvests.length > 0 && (
                                                        <span className="text-blue-500 text-[10px] font-bold">
                                                            {pendingHarvests.length}
                                                        </span>
                                                    )}
                                                </div>
                                            </button>

                                            {isCosechasOpen && (
                                                <div className="pb-2 space-y-0.5">
                                                    {pendingHarvests.length === 0 ? (
                                                        <div className="pl-2 py-1 text-[10px] text-slate-500 italic">No hay cosechas pendientes</div>
                                                    ) : (
                                                        pendingHarvests.map((lot) => (
                                                            <Link
                                                                key={lot.id}
                                                                href={`/clients/${effectiveId}/fields?harvestLotId=${lot.id}`}
                                                                onClick={() => setIsMobileMenuOpen(false)}
                                                                className="block pl-2 py-1.5 text-[11px] font-medium text-blue-300/80 hover:text-white transition-all truncate"
                                                                title={lot.name}
                                                            >
                                                                {lot.name}
                                                            </Link>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                }

                <main className={`p-6 md:p-8 w-full ${pathname?.includes('/stock/history') || pathname?.includes('/admin/tables') || pathname?.includes('/analytics') ? '' : 'max-w-7xl mx-auto'}`}>
                    {children}
                </main>
            </div >
        </div >
    );
}
