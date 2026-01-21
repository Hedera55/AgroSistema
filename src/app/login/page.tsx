'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isLogin) {
                const { error: authError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (authError) throw authError;
                router.push('/');
                router.refresh();
            } else {
                const { error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                        },
                    },
                });
                if (signUpError) throw signUpError;
                alert('Cuenta creada exitosamente! Por favor inicie sesión.');
                setIsLogin(true);
            }
        } catch (err: any) {
            setError(err.message || 'Error en la autenticación');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8 space-y-8 animate-fadeIn">
                <div className="text-center">
                    <h1 className="text-4xl font-black text-emerald-600 tracking-tighter sm:text-5xl">AGRO</h1>
                    <p className="text-slate-500 mt-2 font-medium tracking-tight">Sistema de Gestión Agronómica</p>
                </div>

                <div className="space-y-6">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Bienvenido</h2>
                        <p className="text-slate-500 text-sm">Ingrese sus credenciales para continuar.</p>
                    </div>

                    <div className="flex justify-center mb-6">
                        <div className="bg-slate-100 p-1 rounded-lg flex text-sm font-medium">
                            <button
                                onClick={() => setIsLogin(true)}
                                className={`px-4 py-2 rounded-md transition-all ${isLogin ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}
                            >
                                Iniciar Sesión
                            </button>
                            <button
                                onClick={() => setIsLogin(false)}
                                className={`px-4 py-2 rounded-md transition-all ${!isLogin ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}
                            >
                                Registrarse
                            </button>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <div className="animate-fadeIn">
                                <Input
                                    label="Nombre Completo"
                                    type="text"
                                    placeholder="Juan Pérez"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    required
                                />
                            </div>
                        )}
                        <Input
                            label="Correo Electrónico"
                            type="email"
                            placeholder="usuario@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        <Input
                            label="Contraseña"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />

                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 animate-fadeIn">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full h-12 text-lg font-semibold"
                            isLoading={loading}
                        >
                            {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
                        </Button>
                    </form>
                </div>

                <div className="text-center">
                    <p className="text-xs text-slate-400">
                        &copy; 2026 Agro Management System. Todos los derechos reservados.
                    </p>
                </div>
            </div>
        </div>
    );
}
