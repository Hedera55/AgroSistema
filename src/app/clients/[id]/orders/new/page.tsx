'use client';

import { use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { OrderWizard } from '../components/OrderWizard';

export default function NewOrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: clientId } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get('editId');

    const handleClose = () => {
        router.push(`/clients/${clientId}/orders`);
    };

    return (
        <div className="max-w-4xl mx-auto py-8">
            <OrderWizard 
                clientId={clientId}
                editId={editId}
                onClose={handleClose}
                onOrderCreated={handleClose}
            />
        </div>
    );
}
