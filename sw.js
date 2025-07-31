// sw.js
const CACHE_NAME = 'salepilot-cache-v5'; // Bump version to force update
const IMAGE_CACHE_NAME = 'salepilot-image-cache-v1';

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/vite.svg',
  'https://cdn.tailwindcss.com',
  // Dependencies from importmap
  'https://esm.sh/react@^19.1.0',
  'https://esm.sh/react@^19.1.0/',
  'https://esm.sh/react-dom@^19.1.0/',
  'https://esm.sh/jsbarcode@^3.11.6',
  'https://esm.sh/qrcode@^1.5.3',
  'https://esm.sh/html5-qrcode@^2.3.8',
  'https://esm.sh/jspdf@2.5.1',
  'https://esm.sh/jspdf-autotable@3.8.2',
  'https://esm.sh/express@^5.1.0',
  'https://esm.sh/cors@^2.8.5',
  'https://esm.sh/dotenv@^17.2.1',
  'https://esm.sh/jsonwebtoken@^9.0.2',
  'https://esm.sh/@google/genai@^1.11.0',
];

const APP_FILES = [
    // Core App
    '/index.tsx',
    '/App.tsx',
    '/types.ts',
    // Services
    '/services/api.ts',
    '/services/authService.ts',
    '/services/dbService.ts',
    '/services/geminiService.ts',
    // Utils
    '/utils/currency.ts',
    // Pages
    '/pages/AccountingPage.tsx',
    '/pages/AuditLogPage.tsx',
    '/pages/CategoriesPage.tsx',
    '/pages/CustomersPage.tsx',
    '/pages/InventoryPage.tsx',
    '/pages/LoginPage.tsx',
    '/pages/ProfilePage.tsx',
    '/pages/PurchaseOrdersPage.tsx',
    '/pages/ReportsPage.tsx',
    '/pages/ReturnsPage.tsx',
    '/pages/SalesPage.tsx',
    '/pages/AllSalesPage.tsx',
    '/pages/SettingsPage.tsx',
    '/pages/StockTakePage.tsx',
    '/pages/SuppliersPage.tsx',
    '/pages/UsersPage.tsx',
    // Components
    '/components/Sidebar.tsx',
    '/components/Header.tsx',
    '/components/ProductList.tsx',
    '/components/ProductFormModal.tsx',
    '/components/Snackbar.tsx',
    '/components/StockAdjustmentModal.tsx',
    '/components/CategoryList.tsx',
    '/components/CategoryFormModal.tsx',
    '/components/LabelPrintModal.tsx',
    '/components/LogoutConfirmationModal.tsx',
    '/components/ConfirmationModal.tsx',
    '/components/CameraCaptureModal.tsx',
    '/components/EditProfileModal.tsx',
    '/components/ChangePasswordModal.tsx',
    '/components/accounting/RecordSupplierPaymentModal.tsx',
    '/components/accounting/SalesInvoiceDetailModal.tsx',
    '/components/accounting/SupplierInvoiceDetailModal.tsx',
    '/components/accounting/SupplierInvoiceFormModal.tsx',
    '/components/customers/CustomerDetailView.tsx',
    '/components/customers/CustomerFormModal.tsx',
    '/components/customers/CustomerList.tsx',
    '/components/products/ProductDetailView.tsx',
    '/components/reports/ReportBlock.tsx',
    '/components/sales/CustomerSelect.tsx',
    '/components/sales/QrScannerModal.tsx',
    '/components/sales/SalesList.tsx',
    '/components/sales/SaleDetailModal.tsx',
    '/components/sales/ReceiptModal.tsx',
    '/components/suppliers/SupplierDetailView.tsx',
    '/components/suppliers/SupplierFormModal.tsx',
    '/components/suppliers/SupplierList.tsx',
    '/components/users/UserDetailsView.tsx',
    '/components/users/UserFormModal.tsx',
    '/components/users/UserList.tsx',
    // Icons
    '/components/icons/AdjustmentsHorizontalIcon.tsx',
    '/components/icons/ArchiveBoxIcon.tsx',
    '/components/icons/ArrowDownTrayIcon.tsx',
    '/components/icons/ArrowLeftIcon.tsx',
    '/components/icons/ArrowLeftOnRectangleIcon.tsx',
    '/components/icons/ArrowUturnLeftIcon.tsx',
    '/components/icons/ArrowUpTrayIcon.tsx',
    '/components/icons/BackspaceIcon.tsx',
    '/components/icons/BanknotesIcon.tsx',
    '/components/icons/BuildingStorefrontIcon.tsx',
    '/components/icons/CalculatorIcon.tsx',
    '/components/icons/CalendarDaysIcon.tsx',
    '/components/icons/CameraIcon.tsx',
    '/components/icons/CheckCircleIcon.tsx',
    '/components/icons/ChevronDoubleLeftIcon.tsx',
    '/components/icons/ClipboardDocumentListIcon.tsx',
    '/components/icons/ClockIcon.tsx',
    '/components/icons/CurrencyDollarIcon.tsx',
    '/components/icons/DevicePhoneMobileIcon.tsx',
    '/components/icons/DocumentMagnifyingGlassIcon.tsx',
    '/components/icons/DocumentPlusIcon.tsx',
    '/components/icons/EnvelopeIcon.tsx',
    '/components/icons/ExclamationTriangleIcon.tsx',
    '/components/icons/InformationCircleIcon.tsx',
    '/components/icons/LinkIcon.tsx',
    '/components/icons/MinusCircleIcon.tsx',
    '/components/icons/PencilIcon.tsx',
    '/components/icons/PlusIcon.tsx',
    '/components/icons/PrinterIcon.tsx',
    '/components/icons/QrCodeIcon.tsx',
    '/components/icons/ReceiptPercentIcon.tsx',
    '/components/icons/ReceiptTaxIcon.tsx',
    '/components/icons/RestoreIcon.tsx',
    '/components/icons/ScaleIcon.tsx',
    '/components/icons/ShoppingCartIcon.tsx',
    '/components/icons/SparklesIcon.tsx',
    '/components/icons/TrashIcon.tsx',
    '/components/icons/TrendingDownIcon.tsx',
    '/components/icons/TrendingUpIcon.tsx',
    '/components/icons/TruckIcon.tsx',
    '/components/icons/UserCircleIcon.tsx',
    '/components/icons/UserIcon.tsx',
    '/components/icons/UsersIcon.tsx',
    '/components/icons/XCircleIcon.tsx',
    '/components/icons/XMarkIcon.tsx',
];

const ASSETS_TO_CACHE = [...new Set([...CORE_ASSETS, ...APP_FILES])];


self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching App Shell');
      // Cache each asset individually to handle CORS errors gracefully
      const cachePromises = ASSETS_TO_CACHE.map(url => {
        return cache.add(url).catch(err => {
          console.warn(`Failed to cache asset: ${url}`, err);
          // Continue with installation even if some assets fail to cache
          return Promise.resolve();
        });
      });
      return Promise.all(cachePromises);
    })
  );
});

self.addEventListener('activate', (event) => {
  const allowedCaches = [CACHE_NAME, IMAGE_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!allowedCaches.includes(cacheName)) {
            console.log('Service Worker: Clearing old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignore API calls and non-GET requests
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
    return;
  }

  // Strategy for images from picsum.photos: Stale-While-Revalidate
  if (url.hostname === 'picsum.photos') {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        const networkFetch = fetch(event.request).then(networkResponse => {
          if (networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
            // This is fine, we might be offline. If we have a cached response, it will be used.
        });

        return cachedResponse || networkFetch;
      })
    );
    return; // Important to return here
  }

  // Strategy for app shell and core assets: Cache-First, falling back to Network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // If we found a match in the cache, return it.
      // Otherwise, fetch from the network.
      return cachedResponse || fetch(event.request).then((networkResponse) => {
        // If the fetch was successful, clone the response, cache it, and return it.
        if (networkResponse.ok) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});
