import React, { useState, useMemo, useEffect } from 'react';
import { Product, Category, Supplier, StoreSettings, User } from '../types';
import Header from '../components/Header';
import ProductList from '../components/ProductList';
import ProductFormModal from '../components/ProductFormModal';
import StockAdjustmentModal from '../components/StockAdjustmentModal';
import LabelPrintModal from '../components/LabelPrintModal';
import ProductDetailView from '../components/products/ProductDetailView';
import ArrowLeftIcon from '../components/icons/ArrowLeftIcon';
import { api } from '../services/api';
import ConfirmationModal from '../components/ConfirmationModal';

interface InventoryPageProps {
    products: Product[];
    categories: Category[];
    suppliers: Supplier[];
    onSaveProduct: (product: Product | Omit<Product, 'id'>) => Promise<Product>;
    onDeleteProduct: (productId: string) => void;
    onArchiveProduct: (productId: string) => void;
    onStockChange: (productId: string, newStock: number) => void;
    onAdjustStock: (productId: string, newQuantity: number, reason: string) => void;
    isLoading: boolean;
    error: string | null;
    storeSettings: StoreSettings;
    currentUser: User;
}

const InventoryPage: React.FC<InventoryPageProps> = ({
                                                         products,
                                                         categories,
                                                         suppliers,
                                                         onSaveProduct,
                                                         onDeleteProduct,
                                                         onArchiveProduct,
                                                         onStockChange,
                                                         onAdjustStock,
                                                         isLoading,
                                                         error,
                                                         storeSettings,
                                                         currentUser
                                                     }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [isStockModalOpen, setIsStockModalOpen] = useState(false);
    const [stockAdjustProduct, setStockAdjustProduct] = useState<Product | null>(null);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [productToPrint, setProductToPrint] = useState<Product | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);

    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [detailedProduct, setDetailedProduct] = useState<Product | null>(null);
    const [detailIsLoading, setDetailIsLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);

    const categoryMap = new Map(categories.map(c => [c.id, c]));
    const supplierMap = new Map(suppliers.map(s => [s.id, s]));

    const canManageProducts = currentUser.role === 'admin' || currentUser.role === 'inventory_manager';

    useEffect(() => {
        if (selectedProductId) {
            const fetchProduct = async () => {
                setDetailIsLoading(true);
                setDetailError(null);
                try {
                    const product = await api.get<Product>(`/products/${selectedProductId}`);
                    setDetailedProduct(product);
                } catch (err: any) {
                    setDetailError(err.message);
                } finally {
                    setDetailIsLoading(false);
                }
            };
            fetchProduct();
        } else {
            setDetailedProduct(null);
        }
    }, [selectedProductId]);


    const handleOpenAddModal = () => {
        setEditingProduct(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (product: Product) => {
        setEditingProduct(product);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingProduct(null);
    };

    const handleSave = async (productData: Product | Omit<Product, 'id'>) => {
        try {
            const savedProduct = await onSaveProduct(productData);
            if (detailedProduct && detailedProduct.id === savedProduct.id) {
                setDetailedProduct(savedProduct);
            }
            handleCloseModal();
        } catch (error) {
            // Error snackbar is shown by App.tsx. We just need to keep the modal open.
            console.error("Failed to save product:", error);
        }
    };

    const handleOpenStockModal = (product: Product) => {
        setStockAdjustProduct(product);
        setIsStockModalOpen(true);
    };

    const handleCloseStockModal = () => {
        setIsStockModalOpen(false);
        setStockAdjustProduct(null);
    };

    const handleSaveStockAdjustment = (productId: string, newQuantity: number, reason: string) => {
        onAdjustStock(productId, newQuantity, reason);
        if (detailedProduct && detailedProduct.id === productId) {
            setDetailedProduct(prev => prev ? {...prev, stock: newQuantity} : null);
        }
        handleCloseStockModal();
    };

    const handleOpenPrintModal = (product: Product) => {
        setProductToPrint(product);
        setIsPrintModalOpen(true);
    };

    const handleClosePrintModal = () => {
        setIsPrintModalOpen(false);
        setProductToPrint(null);
    };

    const handleOpenDeleteModal = (product: Product) => {
        setProductToDelete(product);
        setIsDeleteModalOpen(true);
    };

    const handleCloseDeleteModal = () => {
        setProductToDelete(null);
        setIsDeleteModalOpen(false);
    };

    const handleConfirmDelete = () => {
        if (productToDelete) {
            onDeleteProduct(productToDelete.id);
            handleBackToList(); // Go back to list view after deletion
        }
        handleCloseDeleteModal();
    };

    const handleSelectProduct = (product: Product) => {
        setSelectedProductId(product.id);
    };

    const handleBackToList = () => {
        setSelectedProductId(null);
        setSearchTerm(''); // Clear search when going back
    };

    const filteredProducts = products.filter(product => {
        if (!showArchived && product.status === 'archived') {
            return false;
        }

        if (searchTerm.trim() === '') return true;

        const term = searchTerm.toLowerCase();
        const category = product.categoryId ? categoryMap.get(product.categoryId) : null;
        const supplier = product.supplierId ? supplierMap.get(product.supplierId) : null;

        return (
            product.name.toLowerCase().includes(term) ||
            product.sku.toLowerCase().includes(term) ||
            (product.barcode && product.barcode.toLowerCase().includes(term)) ||
            (category && category.name.toLowerCase().includes(term)) ||
            (supplier && supplier.name.toLowerCase().includes(term)) ||
            (product.brand && product.brand.toLowerCase().includes(term))
        );
    });

    const selectedProductCategory = useMemo(() => {
        if (!detailedProduct || !detailedProduct.categoryId) return undefined;
        return categories.find(c => c.id === detailedProduct.categoryId);
    }, [detailedProduct, categories]);

    const selectedProductSupplier = useMemo(() => {
        if (!detailedProduct || !detailedProduct.supplierId) return undefined;
        return suppliers.find(s => s.id === detailedProduct.supplierId);
    }, [detailedProduct, suppliers]);

    const displayedAttributes = useMemo(() => {
        if (!detailedProduct?.categoryId) return [];

        const attributeDefinitions = new Map<string, string>();
        let currentCatId: string | null | undefined = detailedProduct.categoryId;
        while (currentCatId) {
            const category = categories.find(c => c.id === currentCatId);
            if (category) {
                category.attributes.forEach(attr => {
                    if (!attributeDefinitions.has(attr.id)) {
                        attributeDefinitions.set(attr.id, attr.name);
                    }
                });
                currentCatId = category.parentId;
            } else {
                currentCatId = null;
            }
        }

        const attrs: { name: string; value: string }[] = [];
        if (detailedProduct.customAttributes) {
            for (const attrId in detailedProduct.customAttributes) {
                if (attributeDefinitions.has(attrId)) {
                    attrs.push({
                        name: attributeDefinitions.get(attrId)!,
                        value: detailedProduct.customAttributes[attrId]
                    });
                }
            }
        }
        return attrs;
    }, [detailedProduct, categories]);


    if (selectedProductId) {
        return (
            <>
                <div className="flex flex-col h-full bg-gray-100">
                    <header className="bg-white shadow-sm z-10">
                        <div className="mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="flex items-center h-16">
                                <button
                                    onClick={handleBackToList}
                                    className="mr-4 p-2 rounded-full hover:bg-gray-100"
                                    aria-label="Back to product list"
                                >
                                    <ArrowLeftIcon className="w-6 h-6 text-gray-600" />
                                </button>
                                <h1 className="text-xl font-bold leading-7 text-gray-900 sm:truncate">
                                    Product Details
                                </h1>
                            </div>
                        </div>
                    </header>
                    <main className="flex-1 overflow-x-hidden overflow-y-auto">
                        {detailIsLoading && <div className="text-center p-10">Loading product details...</div>}
                        {detailError && <div className="text-center p-10 text-red-500">Error: {detailError}</div>}
                        {detailedProduct && (
                            <ProductDetailView
                                product={detailedProduct}
                                category={selectedProductCategory}
                                supplier={selectedProductSupplier}
                                attributes={displayedAttributes}
                                storeSettings={storeSettings}
                                user={currentUser}
                                onEdit={handleOpenEditModal}
                                onDelete={handleOpenDeleteModal}
                                onArchive={onArchiveProduct}
                                onPrintLabel={handleOpenPrintModal}
                                onAdjustStock={handleOpenStockModal}
                            />
                        )}
                    </main>
                </div>
                {canManageProducts && isModalOpen && (
                    <ProductFormModal
                        isOpen={isModalOpen}
                        onClose={handleCloseModal}
                        onSave={handleSave}
                        productToEdit={editingProduct}
                        categories={categories}
                        suppliers={suppliers}
                        storeSettings={storeSettings}
                    />
                )}
                {canManageProducts && isStockModalOpen && (
                    <StockAdjustmentModal
                        isOpen={isStockModalOpen}
                        onClose={handleCloseStockModal}
                        onSave={handleSaveStockAdjustment}
                        product={stockAdjustProduct}
                    />
                )}
                <LabelPrintModal
                    isOpen={isPrintModalOpen}
                    onClose={handleClosePrintModal}
                    product={productToPrint}
                    storeSettings={storeSettings}
                />
                <ConfirmationModal
                    isOpen={isDeleteModalOpen}
                    onClose={handleCloseDeleteModal}
                    onConfirm={handleConfirmDelete}
                    title="Delete Product"
                    message={
                        <p>Are you sure you want to permanently delete "<strong>{productToDelete?.name}</strong>"? This action cannot be undone.</p>
                    }
                    confirmText="Delete"
                />
            </>
        )
    }

    return (
        <>
            <Header
                title="Product Inventory"
                buttonText={canManageProducts ? "Add Product" : undefined}
                onButtonClick={canManageProducts ? handleOpenAddModal : undefined}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                showArchivedToggle={true}
                showArchived={showArchived}
                setShowArchived={setShowArchived}
            />
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">
                <ProductList
                    products={filteredProducts}
                    categories={categories}
                    onSelectProduct={handleSelectProduct}
                    onStockChange={onStockChange}
                    onAdjustStock={handleOpenStockModal}
                    isLoading={isLoading}
                    error={error}
                    storeSettings={storeSettings}
                    userRole={currentUser.role}
                />
            </main>
            {canManageProducts && isModalOpen && (
                <ProductFormModal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onSave={handleSave}
                    productToEdit={editingProduct}
                    categories={categories}
                    suppliers={suppliers}
                    storeSettings={storeSettings}
                />
            )}
            {canManageProducts && isStockModalOpen && (
                <StockAdjustmentModal
                    isOpen={isStockModalOpen}
                    onClose={handleCloseStockModal}
                    onSave={handleSaveStockAdjustment}
                    product={stockAdjustProduct}
                />
            )}
            <LabelPrintModal
                isOpen={isPrintModalOpen}
                onClose={handleClosePrintModal}
                product={productToPrint}
                storeSettings={storeSettings}
            />
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={handleCloseDeleteModal}
                onConfirm={handleConfirmDelete}
                title="Delete Product"
                message={
                    <p>Are you sure you want to permanently delete "<strong>{productToDelete?.name}</strong>"? This action cannot be undone.</p>
                }
                confirmText="Delete"
            />
        </>
    );
};

export default InventoryPage;