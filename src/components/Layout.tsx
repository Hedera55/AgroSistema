'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { syncService, SyncStatus } from '@/services/sync';
import { db } from '@/services/db';

export default function Layout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { isActive, loading, role, user, isMaster, assignedId, displayName } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
    const [currentClientName, setCurrentClientName] = useState<string | null>(null);
    const [persistedClientId, setPersistedClientId] = useState<string | null>(null);

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!loading && !isActive && pathname !== '/login') {
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
    // - For CLIENT role: ALWAYS use assignedId.
    // - For ADMIN/MASTER: URL takes precedence, then persisted selection.
    const effectiveId = role === 'CLIENT'
        ? assignedId
        : (urlClientId || (persistedClientId && persistedClientId !== 'null' ? persistedClientId : null));
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

    // Show client menu items if we have a context
    const showClientMenu = !!effectiveId;

    const navigation = [
        // For Admin/Master: General Client list
        { name: 'Clientes', href: '/clients', show: isMaster || role === 'ADMIN' },
        // For Master: User management
        { name: 'Usuarios', href: '/admin/users', show: isMaster },
        // For Client Context (available to all if viewing a client)
        { name: 'Galpón', href: `/clients/${effectiveId}/stock`, show: showClientMenu },
        { name: 'Campos', href: `/clients/${effectiveId}/fields`, show: showClientMenu },
        { name: 'Órdenes', href: `/clients/${effectiveId}/orders`, show: showClientMenu },
    ].filter(item => item.show);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    // Don't show sidebar/header on login page
    if (pathname === '/login') {
        return <>{children}</>;
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
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`block px-4 py-3 rounded-lg transition-colors ${isActive
                                    ? 'bg-emerald-600 text-white shadow-lg'
                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                {item.name}
                            </Link>
                        );
                    })}

                    {currentClientName && showClientMenu && (
                        <div className="mt-4 px-4 animate-fadeIn">
                            <Link
                                href={`/clients/${effectiveId}`}
                                className="text-sm text-emerald-500 font-medium truncate tracking-wide hover:text-emerald-400 transition-all block"
                            >
                                {currentClientName}
                            </Link>
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
                            router.push('/login');
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
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                {/* Mobile Header */}
                <header className="md:hidden bg-white shadow-sm p-4 flex justify-between items-center">
                    <span className="font-bold text-emerald-600">AgroSistema</span>
                    <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-600">
                        Menu
                    </button>
                </header>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden bg-slate-900 text-white p-4 space-y-2 border-t border-slate-800">
                        {currentClientName && showClientMenu && (
                            <Link
                                href={`/clients/${effectiveId}`}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="block py-2 text-emerald-500 font-medium border-b border-slate-800 mb-2"
                            >
                                {currentClientName}
                            </Link>
                        )}
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
                )}

                <main className="p-6 md:p-8 max-w-7xl mx-auto w-full">
                    {children}
                </main>
            </div>
        </div>
    );
}
