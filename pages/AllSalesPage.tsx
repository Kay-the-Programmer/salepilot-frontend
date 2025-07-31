
import React, { useState, useMemo, useEffect } from 'react';
import { Sale, Customer, StoreSettings } from '../types';
import Header from '../components/Header';
import SalesList from '../components/sales/SalesList';
import SaleDetailModal from '../components/sales/SaleDetailModal';
import { formatCurrency } from '../utils/currency';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import ArrowDownTrayIcon from '../components/icons/ArrowDownTrayIcon';
import { api } from '../services/api';

interface AllSalesPageProps {
    customers: Customer[];
    storeSettings: StoreSettings;
}

const AllSalesPage: React.FC<AllSalesPageProps> = ({ customers, storeSettings }) => {
    const [salesData, setSalesData] = useState<Sale[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

    useEffect(() => {
        const fetchSales = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (startDate) params.append('startDate', startDate);
                if (endDate) params.append('endDate', endDate);
                if (selectedCustomerId) params.append('customerId', selectedCustomerId);
                if (selectedStatus) params.append('paymentStatus', selectedStatus);

                const fetchedSales = await api.get<Sale[]>(`/sales?${params.toString()}`);
                setSalesData(fetchedSales);
            } catch (err: any) {
                setError(err.message || 'Failed to fetch sales data.');
            } finally {
                setIsLoading(false);
            }
        };

        const timer = setTimeout(() => {
            fetchSales();
        }, 300); // Debounce fetching

        return () => clearTimeout(timer);
    }, [startDate, endDate, selectedCustomerId, selectedStatus]);


    const resetFilters = () => {
        setStartDate('');
        setEndDate('');
        setSelectedCustomerId('');
        setSelectedStatus('');
    };

    const handleExportCSV = () => {
        const headers = ['Transaction ID', 'Timestamp', 'Customer Name', 'Status', 'Subtotal', 'Tax', 'Discount', 'Total'];
        const rows = salesData.map(s => [
            s.transactionId,
            new Date(s.timestamp).toLocaleString(),
            s.customerName || 'N/A',
            s.paymentStatus,
            s.subtotal.toFixed(2),
            s.tax.toFixed(2),
            s.discount.toFixed(2),
            s.total.toFixed(2)
        ]);

        const csvContent = "data:text/csv;charset=utf-8," 
            + [headers, ...rows].map(e => e.join(",")).join("\n");
        
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `sales_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        doc.text("Sales Report", 14, 16);
        (doc as any).autoTable({
            head: [['ID', 'Date', 'Customer', 'Status', 'Total']],
            body: salesData.map(s => [
                s.transactionId,
                new Date(s.timestamp).toLocaleDateString(),
                s.customerName || 'N/A',
                s.paymentStatus,
                formatCurrency(s.total, storeSettings)
            ]),
            startY: 20,
        });
        doc.save(`sales_report_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    return (
        <>
            <Header title="Sales History" />
            <main className="flex-1 overflow-y-auto bg-gray-100 p-4 sm:p-6 lg:p-8">
                <div className="bg-white p-4 rounded-lg shadow mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
                        <div>
                            <label htmlFor="start-date" className="block text-sm font-medium text-gray-700">Start Date</label>
                            <input type="date" id="start-date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"/>
                        </div>
                        <div>
                            <label htmlFor="end-date" className="block text-sm font-medium text-gray-700">End Date</label>
                            <input type="date" id="end-date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"/>
                        </div>
                        <div>
                            <label htmlFor="customer-filter" className="block text-sm font-medium text-gray-700">Customer</label>
                            <select id="customer-filter" value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm">
                                <option value="">All Customers</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700">Status</label>
                            <select id="status-filter" value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm">
                                <option value="">All Statuses</option>
                                <option value="paid">Paid</option>
                                <option value="unpaid">Unpaid</option>
                                <option value="partially_paid">Partially Paid</option>
                            </select>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={resetFilters} className="w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">Reset</button>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={handleExportCSV} className="w-1/2 justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 flex items-center gap-1" title="Export CSV"><ArrowDownTrayIcon className="w-4 h-4" /> CSV</button>
                             <button onClick={handleExportPDF} className="w-1/2 justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 flex items-center gap-1" title="Export PDF"><ArrowDownTrayIcon className="w-4 h-4" /> PDF</button>
                        </div>
                    </div>
                </div>

                {isLoading && <div className="text-center p-10">Loading sales...</div>}
                {error && <div className="text-center p-10 text-red-500">Error: {error}</div>}
                {!isLoading && !error && (
                    <SalesList 
                        sales={salesData}
                        onSelectSale={setSelectedSale}
                        storeSettings={storeSettings}
                    />
                )}
            </main>

            <SaleDetailModal 
                isOpen={!!selectedSale}
                onClose={() => setSelectedSale(null)}
                sale={selectedSale}
                storeSettings={storeSettings}
            />
        </>
    );
};

export default AllSalesPage;
