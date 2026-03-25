'use client';

import { use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { OrderWizard } from '../components/OrderWizard';
import { useAuth } from '@/hooks/useAuth';

export default function NewOrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: clientId } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get('editId');
    const { role } = useAuth();

    const handleClose = () => {
        router.push(`/clients/${clientId}/orders`);
    };

    if (role === 'CONTRATISTA') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="text-6xl mb-4">🚫</div>
                <h2 className="text-2xl font-bold text-slate-800">No disponible para contratistas</h2>
                <p className="text-slate-500 mt-2">No tiene permisos para editar o crear órdenes.</p>
                <button 
                    onClick={handleClose}
                    className="mt-6 text-emerald-600 font-bold hover:underline"
                >
                    Volver a las órdenes
                </button>
            </div>
        );
    }

    return (
        <div className="mx-auto py-8">
            <OrderWizard 
                clientId={clientId}
                editId={editId}
                onClose={handleClose}
                onOrderCreated={handleClose}
            />
        </div>
    );
}
