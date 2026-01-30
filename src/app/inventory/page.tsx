'use client';

import { useState } from 'react';
import { useInventory } from '@/hooks/useInventory';
import { Product, ProductType, Unit } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { generateId } from '@/lib/uuid';

export default function InventoryPage() {
    const { products, addProduct, loading } = useInventory();
    const [isAdding, setIsAdding] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // Form State
    const [newItem, setNewItem] = useState<Partial<Product>>({
        name: '',
        type: 'HERBICIDE',
        unit: 'L',
        activeIngredient: '',
        concentration: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItem.name) return;

        setIsAdding(true);
        try {
            await addProduct({
                id: generateId(),
                name: newItem.name,
                type: newItem.type as ProductType,
                unit: newItem.unit as Unit,
                activeIngredient: newItem.activeIngredient,
                concentration: newItem.concentration
            });
            setShowForm(false);
            setNewItem({ name: '', type: 'HERBICIDE', unit: 'L', activeIngredient: '', concentration: '' });
        } finally {
            setIsAdding(false);
        }
    };

    const productTypes: ProductType[] = ['HERBICIDE', 'FERTILIZER', 'SEED', 'OTHER'];
    const units: Unit[] = ['L', 'KG', 'UNIT'];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Product Catalog</h1>
                    <p className="text-slate-500 mt-1">Manage global inputs available for orders.</p>
                </div>
                <Button onClick={() => setShowForm(!showForm)}>
                    {showForm ? 'Cancel' : 'Add Product'}
                </Button>
            </div>

            {/* Add Product Form - Expandable Panel */}
            {showForm && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 animate-fadeIn">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4">New Product Details</h2>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                        <Input
                            label="Name"
                            placeholder="e.g. Glyphosate 48%"
                            value={newItem.name}
                            onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                            required
                        />

                        <div className="w-full">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                            <select
                                className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                value={newItem.type}
                                onChange={e => setNewItem({ ...newItem, type: e.target.value as ProductType })}
                            >
                                {productTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>

                        <div className="w-full">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
                            <select
                                className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                value={newItem.unit}
                                onChange={e => setNewItem({ ...newItem, unit: e.target.value as Unit })}
                            >
                                {units.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>

                        <Button type="submit" isLoading={isAdding} className="w-full">
                            Save Product
                        </Button>
                    </form>
                </div>
            )}

            {/* Product List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">Loading inventory...</div>
                ) : products.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="mx-auto h-12 w-12 text-slate-300 mb-3">📦</div>
                        <h3 className="text-lg font-medium text-slate-900">No products yet</h3>
                        <p className="text-slate-500">Get started by adding your first input.</p>
                    </div>
                ) : (
                    <div
                        className="overflow-x-auto"
                        onWheel={(e) => {
                            if (e.deltaY !== 0) {
                                e.currentTarget.scrollLeft += e.deltaY;
                            }
                        }}
                    >
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Unit</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {products.map((product) => (
                                    <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-medium text-slate-900">{product.name}</div>
                                            {product.activeIngredient && (
                                                <div className="text-xs text-slate-500">{product.activeIngredient}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${product.type === 'HERBICIDE' ? 'bg-orange-100 text-orange-800' :
                                                    product.type === 'FERTILIZER' ? 'bg-blue-100 text-blue-800' :
                                                        product.type === 'SEED' ? 'bg-green-100 text-green-800' :
                                                            'bg-gray-100 text-gray-800'}`}>
                                                {product.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                            {product.unit}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button className="text-emerald-600 hover:text-emerald-900">Edit</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
