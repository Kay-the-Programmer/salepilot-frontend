import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Product, CartItem, Sale, Customer, StoreSettings, Payment } from '../types';
import { SnackbarType } from '../App';
import PlusIcon from '../components/icons/PlusIcon';
import XMarkIcon from '../components/icons/XMarkIcon';
import ShoppingCartIcon from '../components/icons/ShoppingCartIcon';
import BackspaceIcon from '../components/icons/BackspaceIcon';
import ReceiptModal from '../components/sales/ReceiptModal';
import QrCodeIcon from '../components/icons/QrCodeIcon';
import QrScannerModal from '../components/sales/QrScannerModal';
import CustomerSelect from '../components/sales/CustomerSelect';
import { formatCurrency } from '../utils/currency';
import DocumentPlusIcon from '../components/icons/DocumentPlusIcon';


interface SalesPageProps {
    products: Product[];
    customers: Customer[];
    onProcessSale: (sale: Sale) => Promise<Sale | null>;
    isLoading: boolean;
    showSnackbar: (message: string, type?: SnackbarType) => void;
    storeSettings: StoreSettings;
}

const SalesPage: React.FC<SalesPageProps> = ({ products, customers, onProcessSale, isLoading, showSnackbar, storeSettings }) => {
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [discount, setDiscount] = useState<string>('0');
    const [heldSales, setHeldSales] = useState<CartItem[][]>([]);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [lastSale, setLastSale] = useState<Sale | null>(null);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [appliedStoreCredit, setAppliedStoreCredit] = useState(0);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');

    useEffect(() => {
        const methods = storeSettings.paymentMethods || [];
        if (methods.length > 0) {
            setSelectedPaymentMethod(methods[0].name);
        } else {
            setSelectedPaymentMethod('');
        }
    }, [storeSettings.paymentMethods]);

    const taxRate = storeSettings.taxRate / 100;

    const addToCart = (product: Product) => {
        const existingItem = cart.find(item => item.productId === product.id);
        const stockInCart = existingItem ? existingItem.quantity : 0;

        if (stockInCart < product.stock) {
             if (existingItem) {
                setCart(cart.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item));
             } else {
                setCart([...cart, { productId: product.id, name: product.name, price: product.price, quantity: 1, stock: product.stock, costPrice: product.costPrice }]);
             }
        } else {
            showSnackbar(`You've added all available stock for "${product.name}".`, 'error');
        }
    };

    const updateQuantity = (productId: string, newQuantity: number) => {
        setCart(currentCart => {
            const itemToUpdate = currentCart.find(item => item.productId === productId);
            if (!itemToUpdate) return currentCart;

            if (newQuantity <= 0) {
                return currentCart.filter(item => item.productId !== productId);
            }
            if (newQuantity <= itemToUpdate.stock) {
                 return currentCart.map(item => item.productId === productId ? { ...item, quantity: newQuantity } : item);
            } else {
                showSnackbar(`Quantity for "${itemToUpdate.name}" cannot exceed available stock of ${itemToUpdate.stock}.`, 'error');
                return currentCart; // Do nothing if desired quantity exceeds stock
            }
        });
    };

    const clearCart = useCallback(() => {
        setCart([]);
        setDiscount('0');
        setSelectedCustomer(null);
        setAppliedStoreCredit(0);
    }, []);


    const handleHoldSale = () => {
        if (cart.length === 0) return;
        setHeldSales([...heldSales, cart]);
        clearCart();
        showSnackbar('Sale has been put on hold.', 'info');
    };

    const handleRecallSale = (index: number) => {
        if (cart.length > 0) {
            showSnackbar("Please hold or complete the current sale before recalling another.", 'error');
            return;
        }
        setCart(heldSales[index]);
        setHeldSales(heldSales.filter((_, i) => i !== index));
        showSnackbar(`Sale #${index + 1} recalled.`, 'info');
    };

    const filteredProducts = useMemo(() => {
        const term = searchTerm.toLowerCase();
        if (!term) return products.filter(p => p.status === 'active');
        
        return products.filter(p =>
            p.status === 'active' &&
            (p.name.toLowerCase().includes(term) ||
            (p.sku && p.sku.toLowerCase().includes(term)) ||
            (p.barcode && p.barcode.toLowerCase().includes(term)))
        );
    }, [products, searchTerm]);

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredProducts.length === 1) {
                const product = filteredProducts[0];
                if (product.stock > 0) {
                    addToCart(product);
                    setSearchTerm(''); // Clear search after successful scan
                } else {
                    showSnackbar(`"${product.name}" is out of stock.`, 'error');
                }
            } else if (filteredProducts.length > 1) {
                showSnackbar('Multiple products match. Please select one manually.', 'info');
            } else {
                showSnackbar('No product found for the scanned code.', 'error');
            }
        }
    };
    
    const handleScanSuccess = (decodedText: string) => {
        const product = products.find(p =>
            p.status === 'active' &&
            (p.barcode === decodedText || p.sku === decodedText)
        );

        if (product) {
            addToCart(product);
            showSnackbar(`Added "${product.name}" to cart.`, 'success');
        } else {
            showSnackbar('Product not found for the scanned QR code.', 'error');
        }
        setIsScannerOpen(false);
    };

    const handleScanError = (errorMessage: string) => {
        console.error(errorMessage);
        showSnackbar('QR Scan failed. Please ensure you have granted camera permissions.', 'error');
        setIsScannerOpen(false);
    };


    const { subtotal, discountAmount, taxAmount, total, totalBeforeCredit, finalAppliedCredit } = useMemo(() => {
        const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
        const discountAmount = parseFloat(discount) || 0;
        const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);
        const taxAmount = subtotalAfterDiscount * taxRate;
        const totalBeforeCredit = subtotalAfterDiscount + taxAmount;
        
        const finalAppliedCredit = Math.min(appliedStoreCredit, totalBeforeCredit);

        const total = totalBeforeCredit - finalAppliedCredit;
        return { subtotal, discountAmount, taxAmount, total, totalBeforeCredit, finalAppliedCredit };
    }, [cart, discount, appliedStoreCredit, taxRate]);
    
     const handleApplyStoreCredit = () => {
        if (finalAppliedCredit > 0) { // Toggle off
            setAppliedStoreCredit(0);
        } else { // Toggle on
            const customerCredit = selectedCustomer?.storeCredit || 0;
            const creditToApply = Math.min(totalBeforeCredit, customerCredit);
            setAppliedStoreCredit(creditToApply);
        }
    };
    
    const processTransaction = async (type: 'paid' | 'invoice') => {
        if (cart.length === 0) return;

        const baseSaleData = {
            cart: cart.map(item => ({ ...item, returnedQuantity: 0 })),
            total,
            subtotal,
            tax: taxAmount,
            discount: discountAmount,
            storeCreditUsed: finalAppliedCredit,
            customerId: selectedCustomer?.id,
            customerName: selectedCustomer?.name,
            refundStatus: 'none' as const,
        };
        
        let saleData: Partial<Sale>;

        if (type === 'invoice') {
             const dueDate = new Date();
             dueDate.setDate(dueDate.getDate() + 30); // Net 30
             saleData = {
                ...baseSaleData,
                paymentStatus: 'unpaid',
                amountPaid: 0,
                dueDate: dueDate.toISOString(),
                payments: [],
            };
        } else {
            saleData = {
                ...baseSaleData,
                paymentStatus: 'paid',
                amountPaid: total,
                payments: [{
                    amount: total,
                    method: selectedPaymentMethod,
                }]
            };
        }

        const newSale = await onProcessSale(saleData as Sale);

        if (newSale) {
            if (type === 'invoice') {
                showSnackbar(`Invoice ${newSale.transactionId} created for ${selectedCustomer?.name}.`, 'success');
            } else {
                setLastSale(newSale);
                setShowReceiptModal(true);
            }
            clearCart();
        }
    }


    return (
        <div className="flex flex-col h-full bg-gray-100">
             <header className="bg-white shadow-sm z-10">
                <h1 className="text-2xl font-bold text-gray-900 p-4">Point of Sale</h1>
            </header>
            <div className="flex-grow flex flex-col md:flex-row p-4 gap-4 overflow-hidden">
                {/* Product Selection */}
                <div className="flex-grow flex flex-col bg-white rounded-lg shadow p-4 overflow-hidden">
                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            placeholder="Search products or scan barcode..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                            className="w-full p-2 border rounded-md"
                        />
                        <button
                            onClick={() => setIsScannerOpen(true)}
                            className="p-2 border rounded-md bg-white hover:bg-gray-100 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label="Scan QR Code"
                            title="Scan QR Code"
                        >
                            <QrCodeIcon className="w-6 h-6" />
                        </button>
                    </div>
                    {isLoading ? <div className="text-center p-10">Loading...</div> :
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 overflow-y-auto pr-2">
                        {filteredProducts.map(p => (
                            <button key={p.id} onClick={() => addToCart(p)} disabled={p.stock === 0} className="relative group border rounded-lg p-2 text-center flex flex-col items-center justify-between transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50">
                                <img src={p.imageUrls?.[0] || 'https://picsum.photos/seed/placeholder/200'} alt={p.name} className="w-24 h-24 object-cover rounded-md mb-2"/>
                                <span className="text-sm font-medium text-gray-800 break-words">{p.name}</span>
                                <span className="text-xs text-gray-500">{formatCurrency(p.price, storeSettings)}</span>
                                {p.stock === 0 && <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center font-bold text-red-500 rounded-lg">SOLD OUT</div>}
                                {p.stock > 0 && p.stock <= (p.reorderPoint || storeSettings.lowStockThreshold) && <div className="absolute top-1 right-1 bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full">{p.stock} left</div>}
                            </button>
                        ))}
                    </div>
                    }
                </div>

                {/* Till */}
                <div className="w-full md:w-96 lg:w-1/3 xl:w-1/4 flex-shrink-0 flex flex-col bg-slate-50 rounded-lg shadow">
                    <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                        <h2 className="text-lg font-semibold flex items-center"><ShoppingCartIcon className="w-6 h-6 mr-2"/> Till</h2>
                        <button onClick={clearCart} className="text-sm text-red-500 hover:underline flex items-center gap-1"><XMarkIcon className="w-4 h-4" /> Clear</button>
                    </div>

                    
                    <div className="p-4 border-b border-slate-200">
                        <CustomerSelect customers={customers} selectedCustomer={selectedCustomer} onSelectCustomer={(c) => { setSelectedCustomer(c); setAppliedStoreCredit(0); }} />
                        {selectedCustomer && selectedCustomer.storeCredit > 0 && storeSettings.enableStoreCredit && (
                            <div className="mt-2 text-sm text-green-700 bg-green-50 p-2 rounded-md">
                                Customer has <strong>{formatCurrency(selectedCustomer.storeCredit, storeSettings)}</strong> in store credit.
                            </div>
                        )}
                    </div>
                    
                    
                    {/* Cart Items */}
                    <div className="flex-grow overflow-y-auto min-h-0">
                         {cart.length === 0 ? <div className="text-center text-gray-500 p-8">Cart is empty</div> :
                            <div className="divide-y divide-slate-200">
                                {cart.map(item => (
                                    <div key={item.productId} className="p-3 flex items-center">
                                        <div className="flex-grow">
                                            <p className="font-medium text-sm">{item.name}</p>
                                            <p className="text-xs text-gray-600">{formatCurrency(item.price, storeSettings)}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300">-</button>
                                            <span>{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-50">+</button>
                                        </div>
                                        <p className="w-20 text-right font-semibold text-sm">{formatCurrency(item.price * item.quantity, storeSettings)}</p>
                                    </div>
                                ))}
                            </div>
                        }
                    </div>

                    {/* Held Sales */}
                    {heldSales.length > 0 && <div className="p-2 border-t border-slate-200">
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Held Sales</h3>
                        <div className="flex gap-2 flex-wrap">
                            {heldSales.map((sale, i) => (
                                <button key={i} onClick={() => handleRecallSale(i)} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-md hover:bg-yellow-200">
                                    Sale #{i+1} ({sale.length} items)
                                </button>
                            ))}
                        </div>
                    </div>}

                    {/* Summary */}
                    <div className="p-4 border-t border-slate-200 space-y-2 text-sm">
                        <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal, storeSettings)}</span></div>
                        <div className="flex justify-between items-center">
                            <span>Discount</span>
                            <div className="flex items-center">
                                <span className="mr-1">{storeSettings.currency.symbol}</span>
                                <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} className="w-20 p-1 border rounded-md text-right"/>
                            </div>
                        </div>
                        <div className="flex justify-between"><span>Tax ({ storeSettings.taxRate }%)</span><span>{formatCurrency(taxAmount, storeSettings)}</span></div>
                         {storeSettings.enableStoreCredit && selectedCustomer && selectedCustomer.storeCredit > 0 && (
                             <div className="flex justify-between items-center border-t border-slate-200 pt-2 mt-1">
                                <span>Store Credit</span>
                                {finalAppliedCredit > 0 ? (
                                    <div className="flex items-center gap-2">
                                         <span className="font-semibold text-green-600">-{formatCurrency(finalAppliedCredit, storeSettings)}</span>
                                        <button onClick={handleApplyStoreCredit} className="text-xs text-red-500 hover:underline">Remove</button>
                                    </div>
                                ) : (
                                    <button onClick={handleApplyStoreCredit} disabled={totalBeforeCredit <= 0} className="text-sm font-medium text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed">Apply Credit</button>
                                )}
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-lg border-t border-slate-200 pt-2 mt-2"><span>Total</span><span>{formatCurrency(total, storeSettings)}</span></div>
                    </div>
                    
                    {/* Actions */}
                    <div className="p-4 bg-slate-100 rounded-b-lg border-t border-slate-200 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={handleHoldSale} disabled={cart.length === 0} className="w-full flex items-center justify-center p-3 rounded-md bg-yellow-400 text-yellow-900 font-semibold hover:bg-yellow-500 disabled:bg-yellow-200 disabled:text-yellow-600">
                                <BackspaceIcon className="w-5 h-5 mr-2"/> Hold
                            </button>
                             <select value={selectedPaymentMethod} onChange={e => setSelectedPaymentMethod(e.target.value)} className="w-full p-3 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm font-semibold" disabled={(storeSettings.paymentMethods || []).length === 0}>
                                {(storeSettings.paymentMethods || []).map(method => (
                                    <option key={method.id} value={method.name}>{method.name}</option>
                                ))}
                                 {(storeSettings.paymentMethods || []).length === 0 && <option>No methods</option>}
                            </select>
                        </div>
                        <button onClick={() => processTransaction('paid')} disabled={cart.length === 0 || total < 0} className="w-full flex items-center justify-center p-3 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:bg-blue-400">
                            <span className="mr-2">Pay</span> {formatCurrency(total > 0 ? total : 0, storeSettings)}
                        </button>
                        <button
                            onClick={() => processTransaction('invoice')}
                            disabled={cart.length === 0 || total < 0 || !selectedCustomer}
                            title={!selectedCustomer ? "Select a customer to charge to an account" : ""}
                            className="w-full flex items-center justify-center p-3 rounded-md bg-white text-gray-700 font-semibold border border-gray-300 hover:bg-gray-100 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                            <DocumentPlusIcon className="w-5 h-5 mr-2"/> Charge to Account
                        </button>
                    </div>
                </div>
            </div>
            <QrScannerModal
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScanSuccess={handleScanSuccess}
                onScanError={handleScanError}
            />
            {showReceiptModal && lastSale && (
                <ReceiptModal
                    isOpen={showReceiptModal}
                    onClose={() => setShowReceiptModal(false)}
                    saleData={lastSale}
                    showSnackbar={showSnackbar}
                    storeSettings={storeSettings}
                />
            )}
        </div>
    );
};

export default SalesPage;