'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from "next/image";
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export default function Home() {
  const { role, isMaster, assignedId } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (role === 'CLIENT' && assignedId) {
      router.push(`/clients/${assignedId}`);
    } else if (isMaster || role === 'ADMIN') {
      router.push('/clients');
    }
  }, [role, isMaster, assignedId, router]);

  // Don't render anything if we are redirecting a client
  if (role === 'CLIENT' && assignedId) return null;

  const buttonLabel = (isMaster || role === 'ADMIN') ? 'Gestionar Clientes' : 'Mi Campo';
  const buttonHref = (isMaster || role === 'ADMIN') ? '/clients' : (assignedId ? `/clients/${assignedId}` : '/#');

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Bienvenido a AgroSistema
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            {isMaster || role === 'ADMIN'
              ? 'Sistema de gestión agronómica. Comience administrando sus clientes y sus galpones virtuales.'
              : 'Bienvenido a su campo. Acceda a su galpón virtual, mapas y órdenes de aplicación.'}
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <Link
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-5 text-white transition-colors hover:bg-slate-800 md:w-[200px]"
            href={buttonHref}
          >
            {buttonLabel}
          </Link>
        </div>
      </main>
    </div>
  );
}
