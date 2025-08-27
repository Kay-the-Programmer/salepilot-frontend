import React, { useState, useEffect, useCallback } from 'react';
import { Product, Category, StockTakeSession, Sale, Return, Customer, Supplier, PurchaseOrder, POItem, ReceptionEvent, User, StoreSettings, Account, JournalEntry, JournalEntryLine, AuditLog, Payment, SupplierInvoice, SupplierPayment } from './types';
import Sidebar from './components/Sidebar';
import InventoryPage from './pages/InventoryPage';
import SalesPage from './pages/SalesPage';
import CategoriesPage from './pages/CategoriesPage';
import StockTakePage from './pages/StockTakePage';
import ReturnsPage from './pages/ReturnsPage';
import CustomersPage from './pages/CustomersPage';
import SuppliersPage from './pages/SuppliersPage';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage';
import ReportsPage from './pages/ReportsPage';
import Snackbar from './components/Snackbar';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import LogoutConfirmationModal from './components/LogoutConfirmationModal';
import { getCurrentUser, logout, getUsers, saveUser, deleteUser, verifySession, changePassword } from './services/authService';
import SettingsPage from './pages/SettingsPage';
import UsersPage from './pages/UsersPage';
import AccountingPage from './pages/AccountingPage';
import AllSalesPage from './pages/AllSalesPage';
import AuditLogPage from './pages/AuditLogPage';
import { api, getOnlineStatus, syncOfflineMutations } from './services/api';
import { dbService } from './services/dbService';
import Bars3Icon from './components/icons/Bars3Icon';

// Key helper for persisting the last visited page per user
const getLastPageKey = (userId?: string) => userId ? `salePilot.lastPage.${userId}` : 'salePilot.lastPage';

export type SnackbarType = 'success' | 'error' | 'info' | 'sync';

type SnackbarState = {
    message: string;
    type: SnackbarType;
};

const PERMISSIONS: Record<User['role'], string[]> = {
  admin: ['reports', 'sales', 'sales-history', 'inventory', 'categories', 'stock-takes', 'returns', 'customers', 'suppliers', 'purchase-orders', 'accounting', 'audit-trail', 'users', 'settings', 'profile'],
  staff: ['sales', 'sales-history', 'inventory', 'returns', 'customers', 'profile'],
  inventory_manager: ['reports', 'inventory', 'categories', 'stock-takes', 'suppliers', 'purchase-orders', 'profile']
};

const DEFAULT_PAGES: Record<User['role'], string> = {
    admin: 'reports',
    staff: 'sales',
    inventory_manager: 'inventory'
};

const App: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [sales, setSales] = useState<Sale[]>([]);
    const [returns, setReturns] = useState<Return[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoice[]>([]);
    const [stockTakeSession, setStockTakeSession] = useState<StockTakeSession | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState('reports');
    const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(() => getCurrentUser());
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [installPrompt, setInstallPrompt] = useState<any | null>(null); // PWA install prompt event
    // Mobile sidebar state
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // --- Offline State ---
    const [isOnline, setIsOnline] = useState(getOnlineStatus());
    const [isSyncing, setIsSyncing] = useState(false);

    const showSnackbar = useCallback((message: string, type: SnackbarType = 'info') => {
        setSnackbar({ message, type });
    }, []);

    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            console.log("Install prompt captured");
            setInstallPrompt(e);
        };
        const onInstalled = () => {
            setInstallPrompt(null);
            try { console.log('App installed'); } catch {}
        };
        window.addEventListener('beforeinstallprompt', handler as any);
        window.addEventListener('appinstalled', onInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler as any);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, []);

    const handleInstall = () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        installPrompt.userChoice.then((choiceResult: { outcome: string }) => {
            if (choiceResult.outcome === 'accepted') {
                showSnackbar('SalePilot has been installed!', 'success');
            }
            setInstallPrompt(null);
        });
    };

    // Close mobile sidebar on Escape
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsSidebarOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    // Close mobile sidebar after navigation
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [currentPage]);

    const hasAccess = (page: string, role: User['role']) => {
        return PERMISSIONS[role].includes(page);
    };

    const handleSetCurrentPage = useCallback((page: string) => {
        if (currentUser && hasAccess(page, currentUser.role)) {
            setCurrentPage(page);
            try {
                const key = getLastPageKey(currentUser.id);
                localStorage.setItem(key, page);
            } catch (_) { /* ignore storage errors */ }
        } else {
            showSnackbar("You don't have permission to access this page.", "error");
        }
    }, [currentUser, showSnackbar]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [
                loadedProducts, loadedCategories, loadedCustomers, loadedSuppliers,
                loadedSales, loadedPOs, loadedAccounts, loadedJournalEntries, loadedSupplierInvoices,
                loadedUsers, loadedSettings, loadedReturns, loadedLogs,
                activeStockTake
            ] = await Promise.all([
                api.get<Product[]>('/products'), api.get<Category[]>('/categories'),
                api.get<Customer[]>('/customers'), api.get<Supplier[]>('/suppliers'),
                api.get<Sale[]>('/sales'), api.get<PurchaseOrder[]>('/purchase-orders'),
                api.get<Account[]>('/accounting/accounts'), api.get<JournalEntry[]>('/accounting/journal-entries'),
                api.get<SupplierInvoice[]>('/accounting/supplier-invoices'), api.get<User[]>('/users'),
                api.get<StoreSettings>('/settings'), api.get<Return[]>('/returns'),
                api.get<AuditLog[]>('/audit'), api.get<StockTakeSession | null>('/stock-takes/active'),
            ]);

            setProducts(loadedProducts); dbService.bulkPut('products', loadedProducts);
            setCategories(loadedCategories); dbService.bulkPut('categories', loadedCategories);
            setCustomers(loadedCustomers); dbService.bulkPut('customers', loadedCustomers);
            setSuppliers(loadedSuppliers); dbService.bulkPut('suppliers', loadedSuppliers);
            setSales(loadedSales); dbService.bulkPut('sales', loadedSales);
            setPurchaseOrders(loadedPOs); dbService.bulkPut('purchaseOrders', loadedPOs);
            setAccounts(loadedAccounts); dbService.bulkPut('accounts', loadedAccounts);
            setJournalEntries(loadedJournalEntries); dbService.bulkPut('journalEntries', loadedJournalEntries);
            setSupplierInvoices(loadedSupplierInvoices); dbService.bulkPut('supplierInvoices', loadedSupplierInvoices);
            setUsers(loadedUsers); dbService.bulkPut('users', loadedUsers);
            setReturns(loadedReturns); dbService.bulkPut('returns', loadedReturns);
            setAuditLogs(loadedLogs); dbService.bulkPut('auditLogs', loadedLogs);

            // Handle single-item stores
            setStoreSettings(loadedSettings); dbService.put('settings', loadedSettings, 'main');
            setStockTakeSession(activeStockTake); // Not caching session as it's highly volatile

        } catch (err: any) {
            // Fall back to IndexedDB when API calls fail (offline or backend unreachable)
            try {
                const [
                    cachedProducts, cachedCategories, cachedCustomers, cachedSuppliers,
                    cachedSales, cachedPOs, cachedAccounts, cachedJournalEntries, cachedSupplierInvoices,
                    cachedUsers, cachedReturns, cachedLogs,
                ] = await Promise.all([
                    dbService.getAll<Product>('products'), dbService.getAll<Category>('categories'),
                    dbService.getAll<Customer>('customers'), dbService.getAll<Supplier>('suppliers'),
                    dbService.getAll<Sale>('sales'), dbService.getAll<PurchaseOrder>('purchaseOrders'),
                    dbService.getAll<Account>('accounts'), dbService.getAll<JournalEntry>('journalEntries'),
                    dbService.getAll<SupplierInvoice>('supplierInvoices'), dbService.getAll<User>('users'),
                    dbService.getAll<Return>('returns'), dbService.getAll<AuditLog>('auditLogs'),
                ]);

                const cachedSettings = await dbService.get<StoreSettings>('settings', 'main');

                // Apply cached data to state (use empty arrays if none)
                setProducts(cachedProducts || []);
                setCategories(cachedCategories || []);
                setCustomers(cachedCustomers || []);
                setSuppliers(cachedSuppliers || []);
                setSales(cachedSales || []);
                setPurchaseOrders(cachedPOs || []);
                setAccounts(cachedAccounts || []);
                setJournalEntries(cachedJournalEntries || []);
                setSupplierInvoices(cachedSupplierInvoices || []);
                setUsers(cachedUsers || []);
                setReturns(cachedReturns || []);
                setAuditLogs(cachedLogs || []);

                if (cachedSettings) {
                    setStoreSettings(cachedSettings);
                } else {
                    setStoreSettings(null);
                }

                // StockTake session is not persisted offline; keep null in fallback
                setStockTakeSession(null);

                // Keep an error message to inform the user, but allow operation with cached data
                setError(err.message || 'Offline: using cached data');
            } catch (fallbackErr: any) {
                // If even the cache fails, surface the original error
                setError(err.message || fallbackErr?.message || 'Failed to load data');
            }
        } finally {
            setIsLoading(false);
        }
    }, [showSnackbar]);

     const handleSync = useCallback(async () => {
        if (isSyncing || !getOnlineStatus()) return;
        setIsSyncing(true);
        showSnackbar('Syncing offline changes...', 'sync');
        const { succeeded, failed } = await syncOfflineMutations();
        setIsSyncing(false);

        if (succeeded > 0 || failed > 0) {
            if (failed > 0) {
                showSnackbar(`Sync complete. ${succeeded} succeeded, ${failed} failed.`, 'error');
            } else {
                showSnackbar(`Successfully synced ${succeeded} offline changes.`, 'success');
            }
            fetchData(); // Refetch all data to get the latest state from the server
        }
    }, [isSyncing, showSnackbar, fetchData]);

    useEffect(() => {
        const handleStatusChange = () => {
            const onlineStatus = getOnlineStatus();
            setIsOnline(onlineStatus);
            if (onlineStatus) {
                handleSync();
            }
        };
        window.addEventListener('onlineStatusChange', handleStatusChange);
        return () => window.removeEventListener('onlineStatusChange', handleStatusChange);
    }, [handleSync]);

    useEffect(() => {
        const checkSession = async () => {
            const localUser = getCurrentUser();
            if (localUser && localUser.token) {
                try {
                    const verifiedUser = await verifySession();
                    const authedUser = { ...verifiedUser, token: localUser.token } as User;
                    setCurrentUser(authedUser);
                    // Restore last page if available and permitted, otherwise default for role
                    try {
                        const key = getLastPageKey(authedUser.id);
                        const saved = localStorage.getItem(key) || localStorage.getItem(getLastPageKey());
                        const fallback = DEFAULT_PAGES[authedUser.role];
                        setCurrentPage(saved && hasAccess(saved, authedUser.role) ? saved : fallback);
                    } catch (_) {
                        setCurrentPage(DEFAULT_PAGES[authedUser.role]);
                    }
                } catch (error) {
                    console.log("Session verification failed, running in offline mode.");
                    setCurrentUser(localUser as User); // Assume user is valid offline
                    try {
                        const key = getLastPageKey(localUser.id);
                        const saved = localStorage.getItem(key) || localStorage.getItem(getLastPageKey());
                        const fallback = DEFAULT_PAGES[localUser.role];
                        setCurrentPage(saved && hasAccess(saved, localUser.role) ? saved : fallback);
                    } catch (_) {
                        setCurrentPage(DEFAULT_PAGES[localUser.role]);
                    }
                }
            }
            setIsAuthLoading(false);
        };
        checkSession();
    }, []);

    useEffect(() => {
        if (currentUser) {
            fetchData();
        }
    }, [currentUser, fetchData]);

    const handleLogin = (user: User) => {
        setCurrentUser(user);
        setCurrentPage(DEFAULT_PAGES[user.role]);
        showSnackbar(`Welcome back, ${user.name}!`, 'success');
    };

    const handleLogout = () => setIsLogoutModalOpen(true);
    const handleConfirmLogout = () => {
        logout();
        setCurrentUser(null);
        setIsLogoutModalOpen(false);
        showSnackbar('You have been logged out.', 'info');
    };

    const handleSaveSettings = async (settings: StoreSettings) => {
        try {
            const result = await api.put<StoreSettings>('/settings', settings);
            if (result.offline) {
                showSnackbar('Offline: Settings change queued.', 'info');
            } else {
                setStoreSettings(result);
                showSnackbar('Store settings updated successfully!', 'success');
                fetchData();
            }
        } catch (err: any) {
            showSnackbar(err.message, 'error');
        }
    };

    const handleSaveProduct = async (productData: Product | Omit<Product, 'id'>): Promise<Product> => {
        try {
            const isUpdating = 'id' in productData && !!(productData as Product).id;

            // Special case: some callers (e.g., ProductFormModal) already perform the API call
            // and pass back the saved Product. If this product is not yet in our state,
            // insert it immediately and skip making another request.
            if (isUpdating) {
                const incoming = productData as Product;
                const exists = products.some(p => p.id === incoming.id);
                if (!exists) {
                    setProducts(prev => [incoming, ...prev]);
                    showSnackbar('Product added successfully!', 'success');
                    return incoming;
                }
            }

            // Use FormData for both creating and updating to consistently handle images (kept for future compatibility)
            const formData = new FormData();
            Object.keys(productData).forEach(key => {
                const value = (productData as any)[key];
                if (key === 'images' && Array.isArray(value)) {
                    value.forEach(image => {
                        // We only append new files, not existing URL strings
                        if (image instanceof File) {
                            formData.append('images', image);
                        }
                    });
                } else if (value !== null && value !== undefined) {
                    formData.append(key, value);
                }
            });

            // If updating, send existing image URLs so the backend knows what to keep
            if (isUpdating && (productData as Product).imageUrls) {
                formData.append('existing_images', JSON.stringify((productData as Product).imageUrls));
            }

            const savedProduct = isUpdating
                ? await api.put<Product & { offline?: boolean }>(`/products/${(productData as Product).id}`, productData)
                // Send as JSON, the backend handles both content types now.
                : await api.post<Product & { offline?: boolean }>('/products', productData);

            if ((savedProduct as any).offline) {
                showSnackbar(`Offline: Change for "${(productData as any).name}" queued.`, 'info');
                const tempId = isUpdating ? (productData as Product).id : `offline_${Date.now()}`;
                const tempProduct = { ...(productData as any), id: tempId, imageUrls: [] } as Product;
                // UI update for offline
                if (isUpdating) {
                    setProducts(prev => prev.map(p => p.id === tempId ? tempProduct : p));
                } else {
                    setProducts(prev => [tempProduct, ...prev]);
                }
                // Persist to IndexedDB so details remain available after reload while offline
                try { await dbService.put('products', tempProduct); } catch (_) {}
                return tempProduct;
            } else {
                showSnackbar(`Product ${isUpdating ? 'updated' : 'added'} successfully!`, 'success');
                // Update state directly instead of calling fetchData()
                if (isUpdating) {
                    setProducts(prev => prev.map(p => p.id === (savedProduct as Product).id ? (savedProduct as Product) : p));
                } else {
                    // Add the new product to the top of the list
                    setProducts(prev => [savedProduct as Product, ...prev]);
                }
                return savedProduct as Product;
            }
        } catch (err: any) {
            // The error message from the backend is more user-friendly
            const message = err.response?.data?.message || err.message;
            showSnackbar(message, 'error');
            throw err;
        }
    };

    const handleDeleteProduct = async (productId: string) => {
        try {
            const result = await api.delete(`/products/${productId}`);
            if (result.offline) {
                showSnackbar('Offline: Product deletion queued.', 'info');
            } else {
                showSnackbar('Product permanently deleted.', 'success');
                fetchData();
            }
        } catch (err: any) {
            showSnackbar(err.message, 'error');
        }
    };

    const handleArchiveProduct = async (productId: string) => {
        try {
            const result = await api.patch<Product & { offline?: boolean }>(`/products/${productId}/archive`, {});
             if (result.offline) {
                showSnackbar('Offline: Product status change queued.', 'info');
            } else {
                showSnackbar(`Product ${result.status === 'archived' ? 'archived' : 'restored'}.`, 'info');
                fetchData();
            }
        } catch (err: any) {
            showSnackbar(err.message, 'error');
        }
    };

    const handleStockChange = async (productId: string, newStock: number) => {
        try {
            // Optimistic UI update
            const originalProducts = products;
            setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: newStock } : p));

            const result = await api.patch(`/products/${productId}/stock`, { newQuantity: newStock, reason: 'Quick adjustment' });

            if (result.offline) {
                 showSnackbar('Offline: Stock change queued.', 'info');
            } else {
                fetchData(); // Sync with server state
            }
        } catch (err: any) {
            showSnackbar(err.message, 'error');
            setProducts(await api.get('/products')); // Revert on error
        }
    };

    const handleStockAdjustment = async (productId: string, newQuantity: number, reason: string) => {
        try {
            const result = await api.patch(`/products/${productId}/stock`, { newQuantity, reason });
            if (result.offline) {
                 showSnackbar('Offline: Stock adjustment queued.', 'info');
            } else {
                setProducts(await api.get('/products'));
                showSnackbar('Stock adjusted successfully.', 'success');
            }
        } catch (err: any) {
            showSnackbar(err.message, 'error');
        }
    };

    const handleProcessSale = async (sale: Sale): Promise<Sale | null> => {
        try {
            // Ensure sale has a transactionId before sending to API
            const saleWithId: Sale = {
                ...sale,
                transactionId: sale.transactionId || `temp_${Date.now()}`,
                timestamp: sale.timestamp || new Date().toISOString()
            };

            const result = await api.post<Sale>('/sales', saleWithId);
            if (result.offline) {
                showSnackbar('Offline: Sale queued for sync.', 'info');

                const tempSale: Sale = {
                    ...saleWithId,
                    transactionId: `offline_${Date.now()}`,
                    timestamp: new Date().toISOString()
                };

                setSales(prev => [tempSale, ...prev]);

                tempSale.cart.forEach(item => {
                    setProducts(prevProducts => prevProducts.map(p => 
                        p.id === item.productId ? { ...p, stock: p.stock - item.quantity } : p
                    ));
                });

                if (tempSale.customerId) {
                    setCustomers(prevCustomers => prevCustomers.map(c => {
                        if (c.id === tempSale.customerId) {
                            return {
                                ...c,
                                storeCredit: c.storeCredit - (tempSale.storeCreditUsed || 0),
                                accountBalance: c.accountBalance + (tempSale.paymentStatus !== 'paid' ? tempSale.total : 0)
                            };
                        }
                        return c;
                    }));
                }

                return tempSale;
            } else {
                showSnackbar('Sale completed successfully!', 'success');
                fetchData(); 
                return result; 
            }
        } catch (err: any) {
            showSnackbar(err.message, 'error');
            return null;
        }
    };

    const handleRecordPayment = async (saleId: string, payment: Omit<Payment, 'id'>) => {
        // Optimistic UI update before awaiting API to ensure immediate UI feedback
        const previousSales = sales;
        const previousCustomers = customers;

        const currentSale = sales.find(s => s.transactionId === saleId);
        if (currentSale) {
            const newAmountPaid = (currentSale.amountPaid || 0) + payment.amount;
            const newStatus: Sale['paymentStatus'] = newAmountPaid >= currentSale.total ? 'paid' : 'partially_paid';
            setSales(prev => prev.map(s => s.transactionId === saleId ? {
                ...s,
                amountPaid: newAmountPaid,
                paymentStatus: newStatus,
                payments: [...(s.payments || []), { id: `temp_${Date.now()}`, ...payment }]
            } : s));
            if (currentSale.customerId) {
                setCustomers(prev => prev.map(c => c.id === currentSale.customerId ? {
                    ...c,
                    accountBalance: Math.max(0, c.accountBalance - payment.amount)
                } : c));
            }
        }

        try {
            const result = await api.post<Sale>(`/sales/${saleId}/payments`, payment);
            if (result.offline) {
                showSnackbar('Offline: Payment record queued.', 'info');
            } else {
                showSnackbar('Payment recorded.', 'success');
                // Re-sync to ensure amounts and payments list are consistent with server (IDs, timestamps)
                fetchData();
            }
        } catch (err: any) {
            // Rollback optimistic update on error
            setSales(previousSales);
            setCustomers(previousCustomers);
            showSnackbar(err.message, 'error');
        }
    };

    const handleProcessReturn = async (returnInfo: Return) => {
        try {
            const result = await api.post<Return>('/returns', returnInfo);
             if (result.offline) {
                showSnackbar('Offline: Return queued for sync.', 'info');
            } else {
                showSnackbar('Return processed successfully!', 'success');
                fetchData();
            }
        } catch (err: any) {
            showSnackbar(err.message, 'error');
        }
    };

    // Generic save handler to reduce boilerplate for simple entities
    const createSaveHandler = <T extends {id?: any, name?: string}>(
        entityName: string,
        endpoint: string,
        stateSetter: React.Dispatch<React.SetStateAction<T[]>>,
        currentState: T[]
    ) => async (item: T) => {
        try {
            const isUpdating = currentState.some(e => e.id === item.id);
            const result = await (isUpdating ? api.put(`${endpoint}/${item.id}`, item) : api.post(endpoint, item));
            if (result.offline) {
                showSnackbar(`Offline: ${entityName} changes queued.`, 'info');
            } else {
                showSnackbar(`${entityName} ${isUpdating ? 'updated' : 'saved'}!`, 'success');
                fetchData();
            }
        } catch (err: any) {
            showSnackbar(err.message, 'error');
        }
    };

    const handleSaveCategory = createSaveHandler('Category', '/categories', setCategories, categories);
    const handleSaveCustomer = createSaveHandler('Customer', '/customers', setCustomers, customers);
    const handleSaveSupplier = createSaveHandler('Supplier', '/suppliers', setSuppliers, suppliers);
    const handleSavePurchaseOrder = createSaveHandler('Purchase Order', '/purchase-orders', setPurchaseOrders, purchaseOrders);
    const handleSaveAccount = createSaveHandler('Account', '/accounting/accounts', setAccounts, accounts);
    const handleSaveSupplierInvoice = createSaveHandler('Supplier Invoice', '/accounting/supplier-invoices', setSupplierInvoices, supplierInvoices);

    const handleDeleteCategory = async (categoryId: string) => {
        if (window.confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
            try {
                const result = await api.delete(`/categories/${categoryId}`);
                if (result.offline) { showSnackbar('Offline: Deletion queued.', 'info'); } else { fetchData(); }
            } catch (err: any) { showSnackbar(err.message, 'error'); }
        }
    };

    const handleDeleteCustomer = async (customerId: string) => {
        if (window.confirm('Are you sure you want to delete this customer? This action cannot be undone.')) {
             try {
                const result = await api.delete(`/customers/${customerId}`);
                if (result.offline) { showSnackbar('Offline: Deletion queued.', 'info'); } else { fetchData(); }
            } catch (err: any) { showSnackbar(err.message, 'error'); }
        }
    };

    const handleDeleteSupplier = async (supplierId: string) => {
        if (window.confirm('Are you sure you want to delete this supplier? This may affect linked products.')) {
             try {
                const result = await api.delete(`/suppliers/${supplierId}`);
                if (result.offline) { showSnackbar('Offline: Deletion queued.', 'info'); } else { fetchData(); }
            } catch (err: any) { showSnackbar(err.message, 'error'); }
        }
    };

    const handleDeletePurchaseOrder = async (poId: string) => {
        try {
            const result = await api.delete(`/purchase-orders/${poId}`);
            if (result.offline) { showSnackbar('Offline: Deletion queued.', 'info'); } else { fetchData(); }
        } catch (err: any) { showSnackbar(err.message, 'error'); }
    };

    const handleReceivePOItems = async (poId: string, receivedItems: { productId: string, quantity: number }[]) => {
        try {
            const result = await api.post(`/purchase-orders/${poId}/receive`, receivedItems);
            if (result.offline) { showSnackbar('Offline: Stock reception queued.', 'info'); } else { fetchData(); }
        } catch (err: any) { showSnackbar(err.message, 'error'); }
    };

    const handleStartStockTake = async () => {
        try {
            const newSession = await api.post<StockTakeSession>('/stock-takes', {});
            setStockTakeSession(newSession);
            handleSetCurrentPage('stock-takes');
            showSnackbar('New stock take session started.', 'info');
        } catch (err: any) {
            showSnackbar(err.message, 'error');
        }
    };

    const handleUpdateStockTakeItem = async (productId: string, count: number | null) => {
        try {
            const updatedSession = await api.put<StockTakeSession>(`/stock-takes/active/items/${productId}`, { count });
            setStockTakeSession(updatedSession);
        } catch (err: any) {
            showSnackbar(err.message, 'error');
        }
    };

    const handleCancelStockTake = async () => {
        if (window.confirm('Are you sure you want to cancel? All progress will be lost.')) {
            try {
                await api.delete('/stock-takes/active');
                setStockTakeSession(null);
                showSnackbar('Stock take cancelled.', 'info');
            } catch (err: any) {
                showSnackbar(err.message, 'error');
            }
        }
    };

    const handleFinalizeStockTake = async () => {
        try {
            await api.post('/stock-takes/active/finalize', {});
            showSnackbar('Stock take complete and inventory updated.', 'success');
            setStockTakeSession(null);
            fetchData();
        } catch (err: any) {
            showSnackbar(err.message, 'error');
        }
    };

    const handleSaveUser = async (userData: Omit<User, 'id'>, id?: string) => {
        try {
            await saveUser(userData, id);
            setUsers(await getUsers());
            showSnackbar(`User ${id ? 'updated' : 'created'} successfully!`, 'success');
        } catch(err: any) {
            showSnackbar(err.message, 'error');
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if(userId === currentUser?.id) {
            showSnackbar("You cannot delete your own account.", "error");
            return;
        }
        if (window.confirm("Are you sure you want to delete this user?")) {
            try {
                await deleteUser(userId);
                setUsers(await getUsers());
                showSnackbar("User deleted successfully.", "success");
            } catch (err: any) {
                showSnackbar(err.message, "error");
            }
        }
    };

    const handleUpdateProfile = async (userData: { name: string; email: string }) => {
        if (!currentUser) throw new Error("No user logged in");
        try {
            const payload = { ...userData, role: currentUser.role }; // Preserve role
            await saveUser(payload, currentUser.id);
            const updatedUser = { ...currentUser, ...userData };
            setCurrentUser(updatedUser);
            showSnackbar('Profile updated successfully!', 'success');
        } catch (err: any) {
            showSnackbar(err.message, 'error');
            throw err; // Propagate error to modal
        }
    };

    const handleChangePassword = async (passwordData: { currentPassword: string, newPassword: string }) => {
        try {
            await changePassword(passwordData);
            showSnackbar('Password changed successfully!', 'success');
        } catch (err: any) {
            showSnackbar(err.message, 'error');
            throw err; // Propagate error to modal
        }
    };

    // --- Accounting Handlers ---
    const handleDeleteAccount = async (accountId: string) => {
        if (window.confirm('Are you sure you want to delete this account?')) {
            try {
                const result = await api.delete(`/accounting/accounts/${accountId}`);
                if (result.offline) { showSnackbar('Offline: Deletion queued.', 'info'); } else { fetchData(); }
            } catch (err: any) { showSnackbar(err.message, 'error'); }
        }
    };
    const handleAddManualJournalEntry = async (entry: Omit<JournalEntry, 'id'>) => {
        try {
            const result = await api.post('/accounting/journal-entries', entry);
            if (result.offline) { showSnackbar('Offline: Journal entry queued.', 'info'); } else { fetchData(); }
        } catch (err: any) { showSnackbar(err.message, 'error'); }
    };
    const handleRecordSupplierPayment = async (invoiceId: string, payment: Omit<SupplierPayment, 'id'>) => {
        try {
            const result = await api.post(`/accounting/supplier-invoices/${invoiceId}/payments`, payment);
            if (result.offline) { showSnackbar('Offline: Supplier payment queued.', 'info'); } else { fetchData(); }
        } catch (err: any) { showSnackbar(err.message, 'error'); }
    };

    if (isAuthLoading) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }

    if (!currentUser) {
        return <LoginPage onLogin={handleLogin} showSnackbar={showSnackbar} />;
    }

    if (!storeSettings && isLoading) {
         return <div className="flex h-screen items-center justify-center">Loading store settings...</div>;
    }

    if (!storeSettings && !isLoading) {
         return <div className="flex h-screen items-center justify-center p-8 text-center text-red-500">Could not load store settings. The application cannot start. Please check your connection or local data.</div>;
    }


    const renderPage = () => {
        if (!hasAccess(currentPage, currentUser.role)) {
             return <div className="p-8 text-center text-red-500">Access Denied. You do not have permission to view this page.</div>;
        }

        switch (currentPage) {
            case 'sales':
                return <SalesPage products={products} customers={customers} onProcessSale={handleProcessSale} isLoading={isLoading} showSnackbar={showSnackbar} storeSettings={storeSettings!} />;
            case 'sales-history':
                return <AllSalesPage customers={customers} storeSettings={storeSettings!} />;
            case 'returns':
                return <ReturnsPage sales={sales} returns={returns} onProcessReturn={handleProcessReturn} showSnackbar={showSnackbar} storeSettings={storeSettings!} />;
            case 'customers':
                 return <CustomersPage customers={customers} sales={sales} onSaveCustomer={handleSaveCustomer} onDeleteCustomer={handleDeleteCustomer} isLoading={isLoading} error={error} storeSettings={storeSettings!} currentUser={currentUser} />;
            case 'suppliers':
                 return <SuppliersPage suppliers={suppliers} products={products} onSaveSupplier={handleSaveSupplier} onDeleteSupplier={handleDeleteSupplier} isLoading={isLoading} error={error} />;
            case 'purchase-orders':
                return <PurchaseOrdersPage purchaseOrders={purchaseOrders} suppliers={suppliers} products={products} onSave={handleSavePurchaseOrder} onDelete={handleDeletePurchaseOrder} onReceiveItems={handleReceivePOItems} showSnackbar={showSnackbar} isLoading={isLoading} error={error} storeSettings={storeSettings!} />;
            case 'categories':
                 return <CategoriesPage categories={categories} accounts={accounts} onSaveCategory={handleSaveCategory} onDeleteCategory={handleDeleteCategory} isLoading={isLoading} error={error} />;
            case 'stock-takes':
                return <StockTakePage session={stockTakeSession} onStart={handleStartStockTake} onUpdateItem={handleUpdateStockTakeItem} onCancel={handleCancelStockTake} onFinalize={handleFinalizeStockTake} />;
             case 'reports':
                return <ReportsPage storeSettings={storeSettings!} />;
            case 'accounting':
                return <AccountingPage accounts={accounts} journalEntries={journalEntries} sales={sales} customers={customers} suppliers={suppliers} supplierInvoices={supplierInvoices} purchaseOrders={purchaseOrders} onSaveAccount={handleSaveAccount} onDeleteAccount={handleDeleteAccount} onAddManualJournalEntry={handleAddManualJournalEntry} onRecordPayment={handleRecordPayment} onSaveSupplierInvoice={handleSaveSupplierInvoice} onRecordSupplierPayment={handleRecordSupplierPayment} isLoading={isLoading} error={error} storeSettings={storeSettings!} />;
            case 'audit-trail':
                return <AuditLogPage logs={auditLogs} users={users} />;
            case 'profile':
                return <ProfilePage user={currentUser} onLogout={handleLogout} onInstall={handleInstall} installPrompt={installPrompt} onUpdateProfile={handleUpdateProfile} onChangePassword={handleChangePassword} />;
            case 'settings':
                return <SettingsPage settings={storeSettings!} onSave={handleSaveSettings} />;
            case 'users':
                return <UsersPage users={users} onSaveUser={handleSaveUser} onDeleteUser={handleDeleteUser} showSnackbar={showSnackbar} isLoading={isLoading} error={error} />;
            case 'inventory':
            default:
                return <InventoryPage products={products} categories={categories} suppliers={suppliers} onSaveProduct={handleSaveProduct} onDeleteProduct={handleDeleteProduct} onArchiveProduct={handleArchiveProduct} onStockChange={handleStockChange} onAdjustStock={handleStockAdjustment} isLoading={isLoading} error={error} storeSettings={storeSettings!} currentUser={currentUser} />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-100 font-sans">
            {/* Mobile overlay/backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-30 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar container: slides on mobile, static on desktop */}
            <div id="app-sidebar" className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 ease-out md:static md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:block`}>
                <Sidebar currentPage={currentPage} setCurrentPage={handleSetCurrentPage} user={currentUser} onLogout={handleLogout} isOnline={isOnline} />
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Mobile top bar with menu button */}
                <div className="md:hidden h-12 bg-gray-100 border-b border-gray-200 flex items-center px-3">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label="Open menu"
                        aria-controls="app-sidebar"
                        aria-expanded={isSidebarOpen}
                    >
                        <Bars3Icon className="w-6 h-6" />
                    </button>
                    <span className="ml-2 font-semibold text-gray-800">Menu</span>
                </div>
                {renderPage()}
            </div>

            {snackbar && <Snackbar message={snackbar.message} type={snackbar.type} onClose={() => setSnackbar(null)} />}
            <LogoutConfirmationModal isOpen={isLogoutModalOpen} onClose={() => setIsLogoutModalOpen(false)} onConfirm={handleConfirmLogout} />
        </div>
    );
};

export default App;
