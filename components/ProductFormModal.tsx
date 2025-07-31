import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, Category, CustomAttribute, Supplier, StoreSettings } from '../types';
import { generateDescription as fetchAIDescription } from '../services/geminiService';
import SparklesIcon from './icons/SparklesIcon';
import XMarkIcon from './icons/XMarkIcon';
import CameraIcon from './icons/CameraIcon';
import CameraCaptureModal from './CameraCaptureModal';
import ArrowUpTrayIcon from './icons/ArrowUpTrayIcon';
import {toSnakeCase} from "@/utils/helpers.ts";

interface ProductFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (product: Product | Omit<Product, 'id'>) => Promise<void>;
    productToEdit?: Product | null;
    categories: Category[];
    suppliers: Supplier[];
    storeSettings: StoreSettings;
}

const ProductFormModal: React.FC<ProductFormModalProps> = ({ isOpen, onClose, onSave, productToEdit, categories, suppliers, storeSettings }) => {

    const getInitialProductState = (): Omit<Product, 'id'> => ({
        name: '',
        description: '',
        sku: `${storeSettings.skuPrefix}${Math.floor(10000 + Math.random() * 90000)}`,
        categoryId: undefined,
        price: 0,
        stock: 0,
        imageUrls: [],
        status: 'active',
        barcode: '',
        costPrice: 0,
        supplierId: undefined,
        brand: '',
        reorderPoint: 0,
        customAttributes: {},
    });

    const [product, setProduct] = useState<Omit<Product, 'id'>>(getInitialProductState());
    const [images, setImages] = useState<string[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);


    useEffect(() => {
        if (isOpen) {
            if (productToEdit) {
                setProduct({ ...getInitialProductState(), ...productToEdit });
                setImages(productToEdit.imageUrls || []);
            } else {
                setProduct(getInitialProductState());
                setImages([]);
            }
            setError('');
            setIsSaving(false);
        }
    }, [productToEdit, isOpen, storeSettings]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const numericFields = ['stock', 'reorderPoint'];
        const stringNumericFields = ['price', 'costPrice'];

        if (name.startsWith('custom_')) {
            const attributeId = name.split('_')[1];
            setProduct(prev => ({
                ...prev,
                customAttributes: {
                    ...prev.customAttributes,
                    [attributeId]: value
                }
            }));
        } else {
            if (numericFields.includes(name)) {
                setProduct(prev => ({ ...prev, [name]: value === '' ? 0 : parseInt(value) }));
            } else if (stringNumericFields.includes(name)) {
                setProduct(prev => ({ ...prev, [name]: value }));
            } else if (name === 'categoryId' || name === 'supplierId') {
                // Handle select fields properly - empty string should become null
                setProduct(prev => ({ ...prev, [name]: value === '' ? undefined : value }));
            } else {
                setProduct(prev => ({ ...prev, [name]: value }));
            }
        }
    };
    const categoryName = useMemo(() => {
        return categories.find(c => c.id === product.categoryId)?.name || '';
    }, [product.categoryId, categories]);

    const handleGenerateDescription = async () => {
        if (!product.name || !product.categoryId) {
            setError('Please enter a Product Name and select a Category to generate a description.');
            return;
        }
        setError('');
        setIsGenerating(true);
        try {
            const description = await fetchAIDescription(product.name, categoryName);
            setProduct(prev => ({ ...prev, description }));
        } catch (err: any) {
            setError(err.message || "An unknown error occurred.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateBarcode = () => {
        setProduct(prev => ({ ...prev, barcode: prev.sku }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving) return;

        const priceNum = parseFloat(product.price.toString());
        if (!product.name || !product.categoryId || priceNum <= 0) {
            setError("Please fill in all required fields: Name, Category, and Price.");
            return;
        }
        setError('');
        setIsSaving(true);

        const finalImageUrls = [...images];
        if (finalImageUrls.length === 0) {
            finalImageUrls.push(`https://picsum.photos/seed/${encodeURIComponent(product.name)}/200`);
        }

        // Prepare the product payload with proper type conversions
        const productPayload = {
            ...product,
            categoryId: product.categoryId || null,
            supplierId: product.supplierId || null,
            costPrice: product.costPrice ? parseFloat(product.costPrice.toString()) : null,
            price: parseFloat(product.price.toString()),
            stock: parseInt(product.stock.toString()),
            reorderPoint: product.reorderPoint ? parseInt(product.reorderPoint.toString()) : null,
            imageUrls: finalImageUrls,
            ...(productToEdit && { id: productToEdit.id })
        };

        // Convert camelCase to snake_case for API
        const apiPayload = toSnakeCase(productPayload);

        try {
            await onSave(apiPayload);
        } catch (err) {
            setError("There was an error saving the product. Please try again.");
            console.error("Save failed in modal", err);
        } finally {
            setIsSaving(false);
        }
    };

    const relevantAttributes = useMemo(() => {
        if (!product.categoryId) return [];

        const allAttributes = new Map<string, CustomAttribute>();
        let currentId: string | null | undefined = product.categoryId;

        while (currentId) {
            const category = categories.find(c => c.id === currentId);
            if (category) {
                category.attributes.forEach(attr => {
                    if (!allAttributes.has(attr.id)) {
                        allAttributes.set(attr.id, attr);
                    }
                });
                currentId = category.parentId;
            } else {
                currentId = null;
            }
        }
        return Array.from(allAttributes.values());
    }, [product.categoryId, categories]);

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (typeof reader.result === 'string') {
                        setImages(prev => [...prev, reader.result as string]);
                    }
                };
                reader.readAsDataURL(file);
            });
        }
    };

    const removeImage = (indexToRemove: number) => {
        setImages(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const handleCameraCapture = (imageDataUrl: string) => {
        setImages(prev => [...prev, imageDataUrl]);
        setIsCameraModalOpen(false);
    };

    if (!isOpen) return null;

    const renderSectionTitle = (title: string) => <h4 className="text-md font-semibold text-gray-800 mt-6 mb-2 border-b pb-1">{title}</h4>;

    return (
        <>
            <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50 transition-opacity" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                <div className="bg-white rounded-lg shadow-xl transform transition-all sm:max-w-2xl w-full m-4">
                    <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-[95vh]">
                        <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4 flex justify-between items-start border-b">
                            <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                {productToEdit ? 'Edit Product' : 'Add New Product'}
                            </h3>
                            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-500">
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="px-4 sm:px-6 py-4 flex-grow overflow-y-auto">
                            {error && <div className="rounded-md bg-red-50 p-4 mb-4"><p className="text-sm text-red-700">{error}</p></div>}

                            {renderSectionTitle('Product Details')}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">Product Name *</label>
                                    <input type="text" name="name" id="name" value={product.name} onChange={handleChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
                                </div>
                                <div>
                                    <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700">Category *</label>
                                    <select name="categoryId" id="categoryId" value={product.categoryId || ''} onChange={handleChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                                        <option value="" disabled>Select a category</option>
                                        {categories.filter(c => c.parentId === null).map(c => (
                                            <React.Fragment key={c.id}>
                                                <option value={c.id} className="font-bold">{c.name}</option>
                                                {categories.filter(sub => sub.parentId === c.id).map(sub => (
                                                    <option key={sub.id} value={sub.id}>&nbsp;&nbsp;{sub.name}</option>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {relevantAttributes.length > 0 && (
                                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {relevantAttributes.map(attr => (
                                        <div key={attr.id}>
                                            <label htmlFor={`custom_${attr.id}`} className="block text-sm font-medium text-gray-700">{attr.name}</label>
                                            <input
                                                type="text"
                                                name={`custom_${attr.id}`}
                                                id={`custom_${attr.id}`}
                                                value={product.customAttributes?.[attr.id] || ''}
                                                onChange={handleChange}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                <div>
                                    <label htmlFor="brand" className="block text-sm font-medium text-gray-700">Brand</label>
                                    <input type="text" name="brand" id="brand" value={product.brand || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
                                </div>
                                <div>
                                    <label htmlFor="supplierId" className="block text-sm font-medium text-gray-700">Supplier</label>
                                    <select name="supplierId" id="supplierId" value={product.supplierId || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                                        <option value="">No Supplier</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="mt-4">
                                <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                                <div className="mt-1 relative">
                                    <textarea name="description" id="description" rows={3} value={product.description} onChange={handleChange} className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm pr-28"/>
                                    <button type="button" onClick={handleGenerateDescription} disabled={isGenerating || !product.name || !product.categoryId} className="absolute top-2 right-2 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
                                        {isGenerating ? 'Generating...' : <> <SparklesIcon className="w-4 h-4 mr-1.5" /> Generate </> }
                                    </button>
                                </div>
                            </div>

                            {renderSectionTitle('Pricing')}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="price" className="block text-sm font-medium text-gray-700">Retail Price *</label>
                                    <input type="number" name="price" id="price" value={product.price} onChange={handleChange} required min="0.01" step="0.01" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
                                </div>
                                <div>
                                    <label htmlFor="costPrice" className="block text-sm font-medium text-gray-700">Cost Price</label>
                                    <input type="number" name="costPrice" id="costPrice" value={product.costPrice || ''} onChange={handleChange} min="0" step="0.01" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
                                </div>
                            </div>

                            {renderSectionTitle('Inventory & Shipping')}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="sku" className="block text-sm font-medium text-gray-700">SKU</label>
                                    <input type="text" name="sku" id="sku" value={product.sku} onChange={handleChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-50 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
                                </div>
                                <div>
                                    <label htmlFor="barcode" className="block text-sm font-medium text-gray-700">Barcode (UPC, EAN, etc.)</label>
                                    <div className="mt-1 flex rounded-md shadow-sm">
                                        <input type="text" name="barcode" id="barcode" value={product.barcode || ''} onChange={handleChange} className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-l-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm border-gray-300"/>
                                        <button type="button" onClick={handleGenerateBarcode} className="-ml-px relative inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 text-sm font-medium rounded-r-md text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
                                            <span>Generate</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                                <div>
                                    <label htmlFor="stock" className="block text-sm font-medium text-gray-700">Stock Quantity *</label>
                                    <input type="number" name="stock" id="stock" value={product.stock} onChange={handleChange} required min="0" step="1" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
                                </div>
                                <div>
                                    <label htmlFor="reorderPoint" className="block text-sm font-medium text-gray-700">Reorder Point</label>
                                    <input type="number" name="reorderPoint" id="reorderPoint" value={product.reorderPoint || ''} onChange={handleChange} min="0" step="1" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder={`Default: ${storeSettings.lowStockThreshold}`}/>
                                </div>
                            </div>


                            {renderSectionTitle('Images')}
                            <div>
                                <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                                    {images.map((imgSrc, index) => (
                                        <div key={index} className="relative group aspect-square">
                                            <img src={imgSrc} alt={`Product image ${index + 1}`} className="w-full h-full object-cover rounded-md shadow-sm border border-gray-200" />
                                            <button
                                                type="button"
                                                onClick={() => removeImage(index)}
                                                className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                                                aria-label="Remove image"
                                            >
                                                <XMarkIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    <div className="flex flex-col gap-2 aspect-square border-2 border-dashed border-gray-300 rounded-md items-center justify-center p-2">
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full text-xs inline-flex items-center justify-center gap-1.5 rounded-md bg-white px-2 py-1.5 font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                        >
                                            <ArrowUpTrayIcon className="w-4 h-4 text-gray-500"/> Upload
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsCameraModalOpen(true)}
                                            className="w-full text-xs inline-flex items-center justify-center gap-1.5 rounded-md bg-white px-2 py-1.5 font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                        >
                                            <CameraIcon className="w-4 h-4 text-gray-500"/> Camera
                                        </button>
                                    </div>
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImageUpload}
                                    className="hidden"
                                    accept="image/*"
                                    multiple
                                />
                                <p className="text-xs text-gray-500 mt-2">The first image will be the primary display image.</p>
                            </div>

                            {renderSectionTitle('Status')}
                            <div>
                                <label htmlFor="status" className="block text-sm font-medium text-gray-700">Product Status</label>
                                <select id="status" name="status" value={product.status} onChange={handleChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                                    <option value="active">Active</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </div>

                        </div>
                        <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t">
                            <button type="submit" disabled={isSaving} className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:bg-blue-400 disabled:cursor-not-allowed">
                                {isSaving ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Saving...
                                    </>
                                ) : 'Save Product'}
                            </button>
                            <button type="button" onClick={onClose} disabled={isSaving} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm disabled:bg-gray-200">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            <CameraCaptureModal
                isOpen={isCameraModalOpen}
                onClose={() => setIsCameraModalOpen(false)}
                onCapture={handleCameraCapture}
            />
        </>
    );
};

export default ProductFormModal;