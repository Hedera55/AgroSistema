'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from "next/image";
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export default function Home() {
  const { role, isMaster, isContratista, assignedId, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;

    if (role === 'CLIENT' && assignedId) {
      router.push(`/clients/${assignedId}`);
    } else if (isMaster || role === 'ADMIN') {
      router.push('/clients');
    } else if (isContratista && assignedId) {
      router.push(`/clients/${assignedId}/orders`);
    }
  }, [role, isMaster, isContratista, assignedId, router, authLoading]);

  // While loading or if we have a role (and thus a redirect is in progress), show nothing or a spinner
  if (authLoading || role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  // Fallback (e.g. if auth fails but doesn't redirect to login yet)
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white sm:items-start text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-black mb-4">
          AgroSistema
        </h1>
        <p className="text-lg text-zinc-600 mb-8">
          Cargando su sesión...
        </p>
        <Link
          href="/login"
          className="bg-slate-900 text-white px-6 py-2 rounded-full font-medium"
        >
          Ir al Login
        </Link>
      </main>
    </div>
  );
}
