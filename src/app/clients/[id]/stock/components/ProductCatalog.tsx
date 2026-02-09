'use client';

import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Product, ProductType, Unit } from '@/types';

interface ProductCatalogProps {
    showCatalog: boolean;
    setShowCatalog: (val: boolean) => void;
    isReadOnly: boolean;
    productsLoading: boolean;
    availableProducts: Product[];
    typeLabels: Record<ProductType, string>;
    deleteProduct: (id: string) => Promise<void>;
    showProductForm: boolean;
    setShowProductForm: (val: boolean) => void;
    setIsEditingProduct: (val: boolean) => void;
    editingProductId: string | null;
    setEditingProductId: (id: string | null) => void;
    handleProductSubmit: (e: React.FormEvent) => Promise<void>;
    newProductType: ProductType;
    setNewProductType: (val: ProductType) => void;
    productTypes: readonly ProductType[];
    newProductPA: string;
    setNewProductPA: (val: string) => void;
    setNewProductName: (val: string) => void;
    newProductCommercialName: string;
    setNewProductCommercialName: (val: string) => void;
    newProductBrand: string;
    setNewProductBrand: (val: string) => void;
    newProductUnit: Unit;
    setNewProductUnit: (val: Unit) => void;
    availableUnits: string[];
    setAvailableUnits: (val: string[]) => void;
    saveClientUnits: (units: string[]) => void;
    showUnitInput: boolean;
    setShowUnitInput: (val: boolean) => void;
    showUnitDelete: boolean;
    setShowUnitDelete: (val: boolean) => void;
    unitInputRef: React.RefObject<HTMLDivElement | null>;
    unitInputValue: string;
    setUnitInputValue: (val: string) => void;
    handleAddUnit: () => void;
    isDuplicate: boolean;
    isSubmitting: boolean;
}

export function ProductCatalog({
    showCatalog,
    setShowCatalog,
    isReadOnly,
    productsLoading,
    availableProducts,
    typeLabels,
    deleteProduct,
    showProductForm,
    setShowProductForm,
    setIsEditingProduct,
    editingProductId,
    setEditingProductId,
    handleProductSubmit,
    newProductType,
    setNewProductType,
    productTypes,
    newProductPA,
    setNewProductPA,
    setNewProductName,
    newProductCommercialName,
    setNewProductCommercialName,
    newProductBrand,
    setNewProductBrand,
    newProductUnit,
    setNewProductUnit,
    availableUnits,
    setAvailableUnits,
    saveClientUnits,
    showUnitInput,
    setShowUnitInput,
    showUnitDelete,
    setShowUnitDelete,
    unitInputRef,
    unitInputValue,
    setUnitInputValue,
    handleAddUnit,
    isDuplicate,
    isSubmitting,
}: ProductCatalogProps) {
    if (!showCatalog) return null;

    return (
        <>
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 animate-fadeIn mb-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold text-slate-900">Catálogo de Productos</h2>
                    <div className="flex items-center gap-4">
                        {!isReadOnly && (
                            <button
                                onClick={() => {
                                    setIsEditingProduct(false);
                                    setEditingProductId(null);
                                    setNewProductName('');
                                    setNewProductBrand('');
                                    setNewProductPA('');
                                    setShowProductForm(true);
                                    setTimeout(() => {
                                        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                                    }, 100);
                                }}
                                className="text-emerald-600 hover:text-emerald-700 text-[10px] font-bold uppercase tracking-widest"
                            >
                                Registrar nuevo producto
                            </button>
                        )}
                        <button
                            onClick={() => setShowCatalog(false)}
                            className="text-slate-400 hover:text-slate-600 p-1"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>
                {productsLoading ? (
                    <div className="p-8 text-center text-slate-500">Cargando catálogo...</div>
                ) : availableProducts.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                        <h3 className="text-lg font-medium text-slate-900">Catálogo vacío</h3>
                        <p>Agregue productos para comenzar.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">P.A. / Cultivo</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nombre Comercial</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Marca</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Unidad</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {availableProducts.map((p) => (
                                    <tr key={p.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">{p.activeIngredient || p.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{p.commercialName || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{p.brandName || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{typeLabels[p.type] || p.type}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{p.unit}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {!isReadOnly && (
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setIsEditingProduct(true);
                                                            setEditingProductId(p.id);
                                                            setNewProductName(p.name);
                                                            setNewProductBrand(p.brandName || '');
                                                            setNewProductCommercialName(p.commercialName || '');
                                                            setNewProductPA(p.activeIngredient || '');
                                                            setNewProductType(p.type);
                                                            setNewProductUnit(p.unit);
                                                            setShowProductForm(true);
                                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                                        }}
                                                        className="text-slate-400 hover:text-emerald-600 px-2 py-1 transition-colors text-[10px] font-bold uppercase tracking-widest"
                                                        title="Editar"
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm('¿Eliminar producto del catálogo?')) await deleteProduct(p.id);
                                                        }}
                                                        className="text-slate-400 hover:text-red-900 px-2 py-1 transition-colors text-[10px] font-bold uppercase tracking-widest"
                                                        title="Eliminar"
                                                    >
                                                        Eliminar
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showProductForm && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-emerald-100 animate-fadeIn mb-8">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-emerald-800">
                            {editingProductId ? 'Editar Producto' : 'Registrar Nuevo Producto'}
                        </h2>
                        <button
                            onClick={() => {
                                setShowProductForm(false);
                                setIsEditingProduct(false);
                                setEditingProductId(null);
                            }}
                            className="text-emerald-500 hover:text-emerald-700 p-1"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>

                    <form onSubmit={handleProductSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="w-full">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                                <select
                                    className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-[42px]"
                                    value={newProductType}
                                    onChange={e => setNewProductType(e.target.value as ProductType)}
                                >
                                    {productTypes.map(t => <option key={t} value={t}>{typeLabels[t]}</option>)}
                                </select>
                            </div>
                            <Input
                                label={newProductType === 'SEED' ? 'Cultivo' : 'P.A. (Principio Activo)'}
                                placeholder={newProductType === 'SEED' ? 'ej. Soja, Maíz...' : 'ej. Glifosato 48%'}
                                value={newProductPA}
                                onChange={e => {
                                    setNewProductPA(e.target.value);
                                    setNewProductName(e.target.value);
                                }}
                                className="h-[42px]"
                                required
                            />
                            <Input
                                label="Nombre Comercial"
                                placeholder="ej. Roundup"
                                value={newProductCommercialName}
                                onChange={e => setNewProductCommercialName(e.target.value)}
                                className="h-[42px]"
                            />
                            <Input
                                label="Marca"
                                placeholder="ej. Bayer"
                                value={newProductBrand}
                                onChange={e => setNewProductBrand(e.target.value)}
                                className="h-[42px]"
                            />
                            <div className="w-full relative">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Unidad</label>
                                <select
                                    className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-[42px]"
                                    value={newProductUnit}
                                    onChange={e => {
                                        if (e.target.value === 'ADD_NEW') {
                                            setShowUnitInput(true);
                                        } else if (e.target.value === 'DELETE_UNIT') {
                                            setShowUnitDelete(true);
                                        } else {
                                            setNewProductUnit(e.target.value as Unit);
                                        }
                                    }}
                                >
                                    {(!newProductUnit || !availableUnits.includes(newProductUnit)) && (
                                        <option value="">Seleccionar...</option>
                                    )}
                                    {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
                                    <option value="ADD_NEW">+ unidad</option>
                                    {availableUnits.length > 0 && (
                                        <option value="DELETE_UNIT">- unidad</option>
                                    )}
                                </select>

                                {showUnitInput && (
                                    <div
                                        ref={unitInputRef}
                                        className="absolute top-0 right-0 left-0 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-30 animate-fadeIn flex gap-2"
                                    >
                                        <input
                                            type="text"
                                            className="flex-1 rounded border-slate-300 text-xs focus:ring-emerald-500 focus:border-emerald-500"
                                            placeholder="NUEVA UNIDAD..."
                                            value={unitInputValue}
                                            onChange={e => setUnitInputValue(e.target.value.toUpperCase())}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddUnit();
                                                }
                                            }}
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddUnit}
                                            className="bg-emerald-500 text-white rounded px-2 py-1 text-xs font-bold hover:bg-emerald-600"
                                        >
                                            +
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowUnitInput(false);
                                                setUnitInputValue('');
                                            }}
                                            className="text-slate-400 p-1 hover:text-slate-600"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                )}

                                {showUnitDelete && (
                                    <div className="absolute top-0 right-0 left-0 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-30 animate-fadeIn pr-6">
                                        <button
                                            type="button"
                                            onClick={() => setShowUnitDelete(false)}
                                            className="absolute top-1 right-1 text-slate-400 hover:text-slate-600 p-1"
                                        >
                                            ✕
                                        </button>
                                        <p className="text-xs text-slate-500 mb-2 font-medium">Eliminar unidad:</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {availableUnits.map(u => (
                                                <button
                                                    key={u}
                                                    type="button"
                                                    onClick={() => {
                                                        const newUnits = availableUnits.filter(unit => unit !== u);
                                                        setAvailableUnits(newUnits);
                                                        saveClientUnits(newUnits);
                                                        if (newProductUnit === u) {
                                                            setNewProductUnit(newUnits[0] as Unit || '');
                                                        }
                                                    }}
                                                    className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold uppercase border border-slate-200 hover:bg-slate-200 hover:border-slate-300 transition-colors"
                                                >
                                                    {u} ✕
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 mt-4 border-t pt-4">
                            {isDuplicate && (
                                <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg animate-fadeIn flex-1 sm:flex-initial">
                                    <p className="text-xs font-bold text-red-600 uppercase tracking-tight">
                                        ⚠️ Este producto ya existe en el catálogo
                                    </p>
                                </div>
                            )}
                            <div className="flex gap-3">
                                <Button type="submit" isLoading={isSubmitting} disabled={isDuplicate}>
                                    {editingProductId ? 'Actualizar en Catálogo' : 'Guardar en Catálogo'}
                                </Button>
                            </div>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
}
