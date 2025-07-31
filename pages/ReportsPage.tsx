
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { StoreSettings } from '../types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import CurrencyDollarIcon from '../components/icons/CurrencyDollarIcon';
import MinusCircleIcon from '../components/icons/MinusCircleIcon';
import TrendingUpIcon from '../components/icons/TrendingUpIcon';
import ScaleIcon from '../components/icons/ScaleIcon';
import ReportBlock from '../components/reports/ReportBlock';
import ReceiptTaxIcon from '../components/icons/ReceiptTaxIcon';
import ReceiptPercentIcon from '../components/icons/ReceiptPercentIcon';
import ArchiveBoxIcon from '../components/icons/ArchiveBoxIcon';
import UsersIcon from '../components/icons/UsersIcon';
import ArrowDownTrayIcon from '../components/icons/ArrowDownTrayIcon';
import { formatCurrency } from '../utils/currency';
import PlusIcon from '../components/icons/PlusIcon';
import TrendingDownIcon from '../components/icons/TrendingDownIcon';
import { api } from '../services/api';


interface ReportsPageProps {
    storeSettings: StoreSettings;
}

const toDateInputString = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; color: string; }> = ({ title, value, icon, color }) => (
    <div className="relative overflow-hidden rounded-lg bg-white p-5 shadow">
        <div className={`absolute top-0 right-0 -mt-4 -mr-4 h-20 w-20 rounded-full ${color} opacity-20`}></div>
        <div className="flex items-center">
            <div className={`flex-shrink-0 rounded-md p-3 ${color} bg-opacity-10`}>
                {icon}
            </div>
            <div className="ml-5 w-0 flex-1">
                <dl>
                    <dt className="truncate text-sm font-medium text-gray-500">{title}</dt>
                    <dd>
                        <div className="text-2xl font-bold text-gray-900 break-words">{value}</div>
                    </dd>
                </dl>
            </div>
        </div>
    </div>
);

const SalesTrendChart: React.FC<{ data: { date: string; revenue: number; profit: number }[], storeSettings: StoreSettings }> = ({ data, storeSettings }) => {
    const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; revenue: number; profit: number } | null>(null);
    const svgRef = React.useRef<SVGSVGElement>(null);
    const padding = { top: 20, right: 30, bottom: 30, left: 80 };
    const width = 800;
    const height = 300;

    if (data.length === 0) {
        return <div className="text-center text-gray-500 py-10">No data available for the selected period.</div>;
    }

    const maxRevenue = Math.max(...data.map(d => d.revenue), 0) * 1.1 || 100;

    const xScale = (index: number) => padding.left + (index / (data.length - 1)) * (width - padding.left - padding.right);
    const yScale = (value: number) => height - padding.bottom - (value / maxRevenue) * (height - padding.top - padding.bottom);

    const revenuePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d.revenue)}`).join(' ');
    const profitPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d.profit)}`).join(' ');

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const index = Math.round(((x - padding.left) / (width - padding.left - padding.right)) * (data.length - 1));

        if (index >= 0 && index < data.length) {
            const point = data[index];
            setTooltip({
                x: xScale(index),
                y: e.clientY - rect.top,
                date: new Date(point.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                revenue: point.revenue,
                profit: point.profit,
            });
        }
    };
    
    return (
        <div className="relative">
            <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)} className="w-full h-auto">
                {/* Y-axis labels */}
                {[0, 0.25, 0.5, 0.75, 1].map(tick => {
                     const y = padding.top + tick * (height - padding.top - padding.bottom);
                     const value = maxRevenue * (1-tick);
                     return (
                         <g key={tick} className="text-xs text-gray-400">
                             <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="currentColor" strokeDasharray="2,3" />
                             <text x={padding.left - 8} y={y + 4} textAnchor="end">{formatCurrency(value, storeSettings)}</text>
                         </g>
                     )
                })}
                {/* X-axis labels */}
                {data.map((d, i) => {
                    if (data.length > 1 && i % Math.ceil(data.length / 10) === 0) {
                        return (
                            <text key={i} x={xScale(i)} y={height - padding.bottom + 15} textAnchor="middle" className="text-xs text-gray-500">
                                {new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </text>
                        );
                    }
                    return null;
                })}

                <path d={profitPath} fill="none" stroke="#22c55e" strokeWidth="2" />
                <path d={revenuePath} fill="none" stroke="#3b82f6" strokeWidth="2" />

                {tooltip && (
                    <g>
                        <line x1={tooltip.x} y1={padding.top} x2={tooltip.x} y2={height - padding.bottom} stroke="rgba(0,0,0,0.2)" strokeDasharray="4,2"/>
                        <circle cx={tooltip.x} cy={yScale(tooltip.revenue)} r="4" fill="#3b82f6" stroke="white" strokeWidth="2" />
                        <circle cx={tooltip.x} cy={yScale(tooltip.profit)} r="4" fill="#10b981" stroke="white" strokeWidth="2" />
                    </g>
                )}
            </svg>
            {tooltip && (
                <div className="absolute p-2 text-xs bg-white rounded-lg shadow-lg pointer-events-none" style={{ top: `${tooltip.y + 5}px`, left: `${tooltip.x + 5}px`, minWidth: '120px' }}>
                    <p className="font-bold">{tooltip.date}</p>
                    <p className="flex justify-between">
                        <span className="text-blue-600">Revenue:</span>
                        <span className="font-semibold">{formatCurrency(tooltip.revenue, storeSettings)}</span>
                    </p>
                    <p className="flex justify-between">
                        <span className="text-green-600">Profit:</span>
                        <span className="font-semibold">{formatCurrency(tooltip.profit, storeSettings)}</span>
                    </p>
                </div>
            )}
        </div>
    );
};

const CashflowChart: React.FC<{ data: { date: string; inflow: number; outflow: number }[], storeSettings: StoreSettings }> = ({ data, storeSettings }) => {
    const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; inflow: number; outflow: number } | null>(null);
    const svgRef = React.useRef<SVGSVGElement>(null);
    const padding = { top: 20, right: 30, bottom: 30, left: 80 };
    const width = 800;
    const height = 300;

    if (data.length === 0) {
        return <div className="text-center text-gray-500 py-10">No cashflow data available for the selected period.</div>;
    }

    const maxVal = Math.max(...data.flatMap(d => [d.inflow, d.outflow]), 0) * 1.1 || 100;

    const xScale = (index: number) => padding.left + (index / (data.length - 1)) * (width - padding.left - padding.right);
    const yScale = (value: number) => height - padding.bottom - (value / maxVal) * (height - padding.top - padding.bottom);

    const inflowPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d.inflow)}`).join(' ');
    const outflowPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d.outflow)}`).join(' ');

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const index = Math.round(((x - padding.left) / (width - padding.left - padding.right)) * (data.length - 1));

        if (index >= 0 && index < data.length) {
            const point = data[index];
            setTooltip({
                x: xScale(index),
                y: e.clientY - rect.top,
                date: new Date(point.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                inflow: point.inflow,
                outflow: point.outflow,
            });
        }
    };
    
    return (
        <div className="relative">
            <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)} className="w-full h-auto">
                {[0, 0.25, 0.5, 0.75, 1].map(tick => {
                     const y = padding.top + tick * (height - padding.top - padding.bottom);
                     const value = maxVal * (1-tick);
                     return (
                         <g key={tick} className="text-xs text-gray-400">
                             <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="currentColor" strokeDasharray="2,3" />
                             <text x={padding.left - 8} y={y + 4} textAnchor="end">{formatCurrency(value, storeSettings)}</text>
                         </g>
                     )
                })}
                {data.map((d, i) => {
                    if (data.length > 1 && i % Math.ceil(data.length / 10) === 0) {
                        return (
                            <text key={i} x={xScale(i)} y={height - padding.bottom + 15} textAnchor="middle" className="text-xs text-gray-500">
                                {new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </text>
                        );
                    }
                    return null;
                })}

                <path d={outflowPath} fill="none" stroke="#ef4444" strokeWidth="2" />
                <path d={inflowPath} fill="none" stroke="#22c55e" strokeWidth="2" />

                {tooltip && (
                    <g>
                        <line x1={tooltip.x} y1={padding.top} x2={tooltip.x} y2={height - padding.bottom} stroke="rgba(0,0,0,0.2)" strokeDasharray="4,2"/>
                        <circle cx={tooltip.x} cy={yScale(tooltip.inflow)} r="4" fill="#22c55e" stroke="white" strokeWidth="2" />
                        <circle cx={tooltip.x} cy={yScale(tooltip.outflow)} r="4" fill="#ef4444" stroke="white" strokeWidth="2" />
                    </g>
                )}
            </svg>
            {tooltip && (
                <div className="absolute p-2 text-xs bg-white rounded-lg shadow-lg pointer-events-none" style={{ top: `${tooltip.y + 5}px`, left: `${tooltip.x + 5}px`, minWidth: '120px' }}>
                    <p className="font-bold">{tooltip.date}</p>
                    <p className="flex justify-between">
                        <span className="text-green-600">Inflow:</span>
                        <span className="font-semibold">{formatCurrency(tooltip.inflow, storeSettings)}</span>
                    </p>
                    <p className="flex justify-between">
                        <span className="text-red-600">Outflow:</span>
                        <span className="font-semibold">{formatCurrency(tooltip.outflow, storeSettings)}</span>
                    </p>
                </div>
            )}
        </div>
    );
};


const ReportsPage: React.FC<ReportsPageProps> = ({ storeSettings }) => {
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 29); // 30 days including today
        return toDateInputString(d);
    });
    const [endDate, setEndDate] = useState(toDateInputString(new Date()));
    const [activeTab, setActiveTab] = useState('sales');
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);

    const [reportData, setReportData] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchReportData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await api.get(`/reports/dashboard?startDate=${startDate}&endDate=${endDate}`);
                setReportData(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchReportData();
    }, [startDate, endDate]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setIsExportMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const setDatePreset = (days: number) => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - (days - 1));
        setStartDate(toDateInputString(start));
        setEndDate(toDateInputString(end));
    };
    
    const setThisMonth = () => {
        const end = new Date();
        const start = new Date(end.getFullYear(), end.getMonth(), 1);
        setStartDate(toDateInputString(start));
        setEndDate(toDateInputString(end));
    }
    
    const salesTrend = useMemo(() => {
        if (!reportData?.sales?.salesTrend) return [];
        const trend = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
         for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = toDateInputString(d);
            trend.push({
                date: dateStr,
                revenue: reportData.sales.salesTrend[dateStr]?.revenue || 0,
                profit: reportData.sales.salesTrend[dateStr]?.profit || 0,
            });
        }
        return trend;
    }, [reportData, startDate, endDate]);

    const cashflowTrend = useMemo(() => {
        if (!reportData?.cashflow?.cashflowTrend) return [];
        const trend = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
         for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = toDateInputString(d);
            trend.push({
                date: dateStr,
                inflow: reportData.cashflow.cashflowTrend[dateStr]?.inflow || 0,
                outflow: reportData.cashflow.cashflowTrend[dateStr]?.outflow || 0,
            });
        }
        return trend;
    }, [reportData, startDate, endDate]);

    const handleExportCSV = () => {
        // This is a simplified export now, based on aggregated data
        const dateString = `${startDate}_to_${endDate}`;
        let headers: string[] = [];
        let rows: any[][] = [];

        if (activeTab === 'sales' && reportData?.sales) {
            headers = ['Product Name', 'Units Sold', 'Total Revenue'];
            rows = reportData.sales.topProductsByRevenue.map((p: any) => [p.name, p.quantity, p.revenue]);
        }
        // Add more export types for other tabs if needed

        if (headers.length === 0) {
            alert("No data to export for this tab.");
            return;
        }

        const escapeCsvCell = (cell: any) => {
            if (cell == null) return '';
            const cellStr = String(cell);
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
        };

        const csvContent = "data:text/csv;charset=utf-8," 
            + [headers, ...rows].map(e => e.map(escapeCsvCell).join(",")).join("\n");
        
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `${activeTab}_report_${dateString}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const handleExportPDF = () => {
         const doc = new jsPDF();
        const dateString = `${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`;
        
        doc.setFontSize(18);
        doc.text(`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Report`, 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Date Range: ${dateString}`, 14, 29);

        if (activeTab === 'sales' && reportData?.sales) {
            (doc as any).autoTable({
                startY: 35,
                body: [
                    [`Revenue: ${formatCurrency(reportData.sales.totalRevenue, storeSettings)}`, `Gross Profit: ${formatCurrency(reportData.sales.totalProfit, storeSettings)}`],
                    [`Transactions: ${reportData.sales.totalTransactions}`, `Avg. Sale: ${formatCurrency(reportData.sales.avgSaleValue, storeSettings)}`],
                ],
                theme: 'plain',
            });
             (doc as any).autoTable({
                head: [['Top Products by Revenue', 'Revenue']],
                body: reportData.sales.topProductsByRevenue.map((p: any) => [p.name, formatCurrency(p.revenue, storeSettings)]),
                startY: (doc as any).lastAutoTable.finalY + 10,
            });
        }
        // Add more PDF export logic for other tabs if needed

        doc.save(`${activeTab}_report_${dateString}.pdf`);
    };

    const TableRow: React.FC<{ label: string, value: string, rank: number }> = ({ label, value, rank }) => (
        <tr className="hover:bg-gray-50">
            <td className="px-2 py-2 text-sm text-gray-500">{rank}</td>
            <td className="px-2 py-2 text-sm text-gray-900 font-medium truncate" title={label}>{label}</td>
            <td className="px-2 py-2 text-sm text-gray-900 text-right font-semibold">{value}</td>
        </tr>
    );

    const TabButton: React.FC<{ tabName: string, label: string }> = ({ tabName, label }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 
                ${activeTab === tabName 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`
            }
        >
            {label}
        </button>
    );
    
    const renderContent = () => {
        if (isLoading) {
            return <div className="text-center p-10">Loading report data...</div>;
        }
        if (error) {
            return <div className="text-center p-10 text-red-500">Error loading report: {error}</div>;
        }
        if (!reportData) {
            return <div className="text-center p-10 text-gray-500">No data available for the selected period.</div>;
        }
        
        switch (activeTab) {
            case 'sales':
                const sales = reportData.sales;
                return (
                    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                           <StatCard title="Revenue" value={formatCurrency(sales.totalRevenue, storeSettings)} icon={<CurrencyDollarIcon className="h-6 w-6 text-green-600"/>} color="bg-green-100" />
                           <StatCard title="Gross Profit" value={formatCurrency(sales.totalProfit, storeSettings)} icon={<TrendingUpIcon className="h-6 w-6 text-blue-600"/>} color="bg-blue-100" />
                           <StatCard title="Gross Margin" value={`${sales.grossMargin.toFixed(1)}%`} icon={<ReceiptPercentIcon className="h-6 w-6 text-yellow-600"/>} color="bg-yellow-100" />
                           <StatCard title="Transactions" value={`${sales.totalTransactions}`} icon={<ReceiptTaxIcon className="h-6 w-6 text-indigo-600"/>} color="bg-indigo-100" />
                           <StatCard title="Avg. Sale" value={formatCurrency(sales.avgSaleValue, storeSettings)} icon={<ScaleIcon className="h-6 w-6 text-purple-600"/>} color="bg-purple-100" />
                           <StatCard title="COGS" value={formatCurrency(sales.totalCogs, storeSettings)} icon={<MinusCircleIcon className="h-6 w-6 text-red-600"/>} color="bg-red-100" />
                        </div>
                        <ReportBlock title="Sales Trend">
                            <div className="flex items-center space-x-4 pl-6 pb-2 text-sm">
                                <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>Revenue</div>
                                <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>Profit</div>
                            </div>
                            <SalesTrendChart data={salesTrend} storeSettings={storeSettings} />
                        </ReportBlock>
                         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <ReportBlock title="Top Selling Products by Revenue"><table className="w-full"><tbody>{sales.topProductsByRevenue.map((p: any, i: number) => <TableRow key={p.name} rank={i+1} label={p.name} value={formatCurrency(p.revenue, storeSettings)} />)}</tbody></table></ReportBlock>
                            <ReportBlock title="Top Selling Products by Units"><table className="w-full"><tbody>{sales.topProductsByQuantity.map((p: any, i: number) => <TableRow key={p.name} rank={i+1} label={p.name} value={`${p.quantity} units`} />)}</tbody></table></ReportBlock>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <ReportBlock title="Sales by Category"><table className="w-full"><tbody>{sales.salesByCategory.map((c: any, i: number) => <TableRow key={c.name} rank={i+1} label={c.name} value={formatCurrency(c.revenue, storeSettings)} />)}</tbody></table></ReportBlock>
                        </div>
                    </div>
                );
            case 'inventory':
                 const inventory = reportData.inventory;
                 return (
                     <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard title="Inventory Retail Value" value={formatCurrency(inventory.totalRetailValue, storeSettings)} icon={<CurrencyDollarIcon className="h-6 w-6 text-blue-600"/>} color="bg-blue-100" />
                            <StatCard title="Inventory Cost Value" value={formatCurrency(inventory.totalCostValue, storeSettings)} icon={<MinusCircleIcon className="h-6 w-6 text-yellow-600"/>} color="bg-yellow-100" />
                            <StatCard title="Potential Profit" value={formatCurrency(inventory.potentialProfit, storeSettings)} icon={<TrendingUpIcon className="h-6 w-6 text-green-600"/>} color="bg-green-100" />
                            <StatCard title="Total Units on Hand" value={inventory.totalUnits.toLocaleString()} icon={<ArchiveBoxIcon className="h-6 w-6 text-purple-600"/>} color="bg-purple-100" />
                        </div>
                    </div>
                 );
            case 'customers':
                const customers = reportData.customers;
                return (
                    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard title="Total Customers" value={customers.totalCustomers.toLocaleString()} icon={<UsersIcon className="h-6 w-6 text-blue-600"/>} color="bg-blue-100" />
                            <StatCard title="Active Customers" value={customers.activeCustomersInPeriod.toLocaleString()} icon={<TrendingUpIcon className="h-6 w-6 text-green-600"/>} color="bg-green-100" />
                            <StatCard title="New Customers" value={customers.newCustomersInPeriod.toLocaleString()} icon={<PlusIcon className="h-6 w-6 text-indigo-600"/>} color="bg-indigo-100" />
                            <StatCard title="Store Credit Owed" value={formatCurrency(customers.totalStoreCreditOwed, storeSettings)} icon={<CurrencyDollarIcon className="h-6 w-6 text-yellow-600"/>} color="bg-yellow-100" />
                        </div>
                    </div>
                );
            case 'cashflow':
                 const cashflow = reportData.cashflow;
                 return (
                    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                           <StatCard title="Total Inflow" value={formatCurrency(cashflow.totalInflow, storeSettings)} icon={<TrendingUpIcon className="h-6 w-6 text-green-600"/>} color="bg-green-100" />
                           <StatCard title="Total Outflow" value={formatCurrency(cashflow.totalOutflow, storeSettings)} icon={<TrendingDownIcon className="h-6 w-6 text-red-600"/>} color="bg-red-100" />
                           <StatCard title="Net Cashflow" value={formatCurrency(cashflow.netCashflow, storeSettings)} icon={<ScaleIcon className={`h-6 w-6 ${cashflow.netCashflow >= 0 ? 'text-blue-600' : 'text-red-600'}`}/>} color={`${cashflow.netCashflow >= 0 ? 'bg-blue-100' : 'bg-red-100'}`} />
                        </div>
                         <ReportBlock title="Cashflow Trend">
                            <div className="flex items-center space-x-4 pl-6 pb-2 text-sm">
                                <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>Inflow</div>
                                <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>Outflow</div>
                            </div>
                            <CashflowChart data={cashflowTrend} storeSettings={storeSettings} />
                        </ReportBlock>
                    </div>
                 );
            default:
                return null;
        }
    };


    return (
        <div className="flex flex-col h-full bg-gray-50">
            <header className="bg-white shadow-sm z-10 p-4 border-b">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                    <div className="flex items-center gap-2 flex-wrap">
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-1.5 border rounded-md text-sm" />
                        <span className="text-gray-500">to</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-1.5 border rounded-md text-sm" />
                        <button onClick={() => setDatePreset(7)} className="px-3 py-1.5 text-sm rounded-md bg-white border hover:bg-gray-50">7 Days</button>
                        <button onClick={() => setDatePreset(30)} className="px-3 py-1.5 text-sm rounded-md bg-white border hover:bg-gray-50">30 Days</button>
                        <button onClick={setThisMonth} className="px-3 py-1.5 text-sm rounded-md bg-white border hover:bg-gray-50">This Month</button>
                        <div className="relative" ref={exportMenuRef}>
                            <button
                                onClick={() => setIsExportMenuOpen(prev => !prev)}
                                className="px-3 py-1.5 text-sm rounded-md bg-white border hover:bg-gray-50 flex items-center gap-2"
                                aria-haspopup="true"
                                aria-expanded={isExportMenuOpen}
                            >
                                <ArrowDownTrayIcon className="w-5 h-5" />
                                Export
                            </button>
                            {isExportMenuOpen && (
                                <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-20" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                                    <div className="py-1" role="none">
                                        <a
                                            href="#"
                                            onClick={(e) => { e.preventDefault(); handleExportPDF(); setIsExportMenuOpen(false); }}
                                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            role="menuitem"
                                        >
                                            Download PDF
                                        </a>
                                        <a
                                            href="#"
                                            onClick={(e) => { e.preventDefault(); handleExportCSV(); setIsExportMenuOpen(false); }}
                                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            role="menuitem"
                                        >
                                            Download CSV
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                 <div className="border-b border-gray-200 mb-6">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        <TabButton tabName="sales" label="Sales Reports" />
                        <TabButton tabName="inventory" label="Inventory Reports" />
                        <TabButton tabName="customers" label="Customer Reports" />
                        <TabButton tabName="cashflow" label="Cashflow" />
                    </nav>
                </div>

                {renderContent()}
            </main>
        </div>
    );
};

export default ReportsPage;