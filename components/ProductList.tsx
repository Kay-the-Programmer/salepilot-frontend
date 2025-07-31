import React from 'react';
import { Product, Category, StoreSettings, User } from '../types';
import { formatCurrency } from '../utils/currency';

interface ProductListProps {
    products: Product[];
    categories: Category[];
    onSelectProduct: (product: Product) => void;
    onStockChange: (productId: string, newStock: number) => void;
    onAdjustStock: (product: Product) => void;
    isLoading: boolean;
    error: string | null;
    storeSettings: StoreSettings;
    userRole: User['role'];
}

const ProductList: React.FC<ProductListProps> = ({ products, categories, onSelectProduct, onStockChange, onAdjustStock, isLoading, error, storeSettings, userRole }) => {
    const isStaff = userRole === 'staff';

    const handleStockIncrement = (e: React.MouseEvent, product: Product) => {
        e.stopPropagation();
        onStockChange(product.id, product.stock + 1);
    };

    const handleStockDecrement = (e: React.MouseEvent, product: Product) => {
        e.stopPropagation();
        if (product.stock > 0) {
            onStockChange(product.id, product.stock - 1);
        }
    };

    const getCategoryName = (categoryId?: string) => {
        if (!categoryId) return 'N/A';
        return categories.find(c => c.id === categoryId)?.name || 'Unknown';
    }

    if (isLoading) {
        return <div className="text-center p-10">Loading products...</div>;
    }

    if (error) {
        return <div className="text-center p-10 text-red-500">Error: {error}</div>;
    }

    if (products.length === 0) {
        return <div className="text-center p-10 text-gray-500">No products found. Adjust your search or filters.</div>;
    }

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-8">
            <div className="mt-4 flow-root">
                <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                    <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Product</th>
                                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">SKU</th>
                                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Category</th>
                                    <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Price</th>
                                    <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">Stock</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                {products.map((product) => (
                                    <tr key={product.id} onClick={() => onSelectProduct(product)} className={`cursor-pointer ${product.status === 'archived' ? 'bg-gray-50' : ''} hover:bg-gray-50`}>
                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                                            <div className="flex items-center">
                                                <div className="h-11 w-11 flex-shrink-0">
                                                    <img className="h-11 w-11 rounded-full object-cover" src={product.imageUrls?.[0]} alt={product.name} />
                                                </div>
                                                <div className="ml-4">
                                                    <div className="font-medium text-gray-900">{product.name}</div>
                                                    <div className="mt-1 text-gray-500 truncate max-w-xs">{product.description}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${product.status === 'active' ? 'bg-green-50 text-green-700 ring-green-600/20' : 'bg-gray-50 text-gray-600 ring-gray-500/10'}`}>
                                                    {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                                                </span>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{product.sku}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                                    {getCategoryName(product.categoryId)}
                                                </span>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-900">{formatCurrency(product.price, storeSettings)}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                            <div className="flex items-center justify-center space-x-2" onClick={(e) => e.stopPropagation()}>
                                                <button onClick={(e) => handleStockDecrement(e, product)} className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50" disabled={product.stock <= 0 || isStaff}>-</button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); if (!isStaff) onAdjustStock(product); }}
                                                    title="Make a detailed stock adjustment"
                                                    disabled={isStaff}
                                                    className={`font-medium rounded-md px-2 py-0.5 transition-colors ${isStaff ? 'cursor-default' : 'hover:bg-gray-200'} ${product.stock <= (product.reorderPoint || storeSettings.lowStockThreshold) ? 'text-red-600' : 'text-gray-900'}`}
                                                >
                                                    {product.stock}
                                                </button>
                                                <button onClick={(e) => handleStockIncrement(e, product)} className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50" disabled={isStaff}>+</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductList;