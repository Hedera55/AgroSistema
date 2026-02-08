export default function Loading() {
    return (
        <div className="flex flex-col items-center justify-center p-12 min-h-[50vh] animate-fadeIn">
            <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-6 w-6 bg-emerald-50 rounded-full animate-pulse"></div>
                </div>
            </div>
            <h3 className="mt-6 text-slate-900 font-semibold text-lg tracking-tight">Cargando...</h3>
            <p className="mt-2 text-slate-500 text-sm font-medium">Preparando información del cliente</p>
        </div>
    );
}
