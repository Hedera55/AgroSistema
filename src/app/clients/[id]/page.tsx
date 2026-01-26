'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/services/db';
import { Client } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

export default function ClientDashboard({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { role, profile, isMaster, isContratista, loading: authLoading } = useAuth();
    const [client, setClient] = useState<Client | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading) {
            // Check access
            if (!isMaster && !profile?.assigned_clients?.includes(id)) {
                router.push('/clients');
                return;
            }

            db.get('clients', id).then((c) => {
                setClient(c || null);
                setLoading(false);
            });
        }
    }, [id, authLoading, isMaster, profile, router]);

    useEffect(() => {
        if (!authLoading && isContratista) {
            router.push(`/clients/${id}/orders`);
        }
    }, [isContratista, authLoading, id, router]);

    if (authLoading || loading || isContratista) {
        return <div className="p-8 text-center text-slate-500">Cargando cliente...</div>;
    }

    if (!client) return <div className="p-8 text-center text-red-500">Cliente no encontrado</div>;

    const allCards = [
        {
            id: 'stock',
            title: 'Galpón Virtual',
            description: 'Gestión de stock, compras y saldos de insumos.',
            icon: '📦',
            href: `/clients/${id}/stock`,
            color: 'bg-orange-50 text-orange-700 hover:border-orange-200'
        },
        {
            id: 'fields',
            title: 'Campos y Lotes',
            description: 'Mapa, límites de lotes y gestión de ambientes.',
            icon: '🚜',
            href: `/clients/${id}/fields`,
            color: 'bg-green-50 text-green-700 hover:border-green-200'
        },
        {
            id: 'orders',
            title: 'Órdenes',
            description: 'Ver órdenes de pulverización y planillas de siembra.',
            icon: '📋',
            href: `/clients/${id}/orders`,
            color: 'bg-blue-50 text-blue-700 hover:border-blue-200'
        },
    ];

    const cards = isContratista
        ? allCards.filter(c => c.id === 'orders')
        : allCards;

    return (
        <div className="space-y-6">
            <div>
                <Link href="/clients" className="text-sm text-slate-500 hover:text-emerald-600 mb-2 inline-block">← Volver a Clientes</Link>
                <h1 className="text-3xl font-bold text-slate-900">{client.name}</h1>
                <div className="flex gap-4 text-sm text-slate-500 mt-1">
                    {client.email && <span>📧 {client.email}</span>}
                    {client.phone && <span>📱 {client.phone}</span>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {cards.map((card) => (
                    <Link
                        key={card.title}
                        href={card.href}
                        className={`p-6 rounded-xl border border-transparent shadow-sm transition-all ${card.color} border-slate-100 hover:shadow-md`}
                    >
                        <div className="text-4xl mb-4">{card.icon}</div>
                        <h3 className="text-lg font-bold mb-2">{card.title}</h3>
                        <p className="text-sm opacity-90">{card.description}</p>
                    </Link>
                ))}
            </div>
        </div>
    );
}
