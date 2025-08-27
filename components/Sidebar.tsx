
import React, { useState } from 'react';
import ClipboardDocumentListIcon from './icons/ClipboardDocumentListIcon';
import ArrowUturnLeftIcon from './icons/ArrowUturnLeftIcon';
import UsersIcon from './icons/UsersIcon';
import TruckIcon from './icons/TruckIcon';
import DocumentPlusIcon from './icons/DocumentPlusIcon';
import { User } from '../types';
import ArrowLeftOnRectangleIcon from './icons/ArrowLeftOnRectangleIcon';
import UserIcon from './icons/UserIcon';
import AdjustmentsHorizontalIcon from './icons/AdjustmentsHorizontalIcon';
import CalculatorIcon from './icons/CalculatorIcon';
import DocumentMagnifyingGlassIcon from './icons/DocumentMagnifyingGlassIcon';
import ChevronDoubleLeftIcon from './icons/ChevronDoubleLeftIcon';
import ClockIcon from './icons/ClockIcon';

interface SidebarProps {
    currentPage: string;
    setCurrentPage: (page: string) => void;
    user: User;
    onLogout: () => void;
    isOnline: boolean;
}

const ALL_NAV_ITEMS = [
    { name: 'Dashboard', page: 'reports', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h12A2.25 2.25 0 0 0 20.25 14.25V3M3.75 3H18" />, roles: ['admin', 'inventory_manager'] },
    { name: 'POS Terminal', page: 'sales', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h6m3-3.75l-3 3m0 0l-3-3m3 3V15m6-1.5l3 3m0 0l3-3m-3 3V15" />, roles: ['admin', 'staff'] },
    { name: 'Sales History', page: 'sales-history', icon: <ClockIcon className="w-5 h-5" />, roles: ['admin', 'staff'] },
    { name: 'Inventory', page: 'inventory', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125-.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />, roles: ['admin', 'staff', 'inventory_manager'] },
    { name: 'Categories', page: 'categories', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.75 9.75h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5-13.5h16.5" />, roles: ['admin', 'inventory_manager'] },
    { name: 'Stock Takes', page: 'stock-takes', icon: <ClipboardDocumentListIcon className="w-5 h-5" />, roles: ['admin', 'inventory_manager'] },
    { name: 'Returns', page: 'returns', icon: <ArrowUturnLeftIcon className="w-5 h-5" />, roles: ['admin', 'staff'] },
    { name: 'Customers', page: 'customers', icon: <UsersIcon className="w-5 h-5" />, roles: ['admin', 'staff'] },
    { name: 'Suppliers', page: 'suppliers', icon: <TruckIcon className="w-5 h-5" />, roles: ['admin', 'inventory_manager'] },
    { name: 'Purchase Orders', page: 'purchase-orders', icon: <DocumentPlusIcon className="w-5 h-5" />, roles: ['admin', 'inventory_manager'] },
    { name: 'Accounting', page: 'accounting', icon: <CalculatorIcon className="w-5 h-5" />, roles: ['admin'] },
    { name: 'Audit Trail', page: 'audit-trail', icon: <DocumentMagnifyingGlassIcon className="w-5 h-5" />, roles: ['admin'] },
    { name: 'Users', page: 'users', icon: <UserIcon className="w-5 h-5" />, roles: ['admin'] },
    { name: 'Settings', page: 'settings', icon: <AdjustmentsHorizontalIcon className="w-5 h-5" />, roles: ['admin'] },
    { name: 'Profile', page: 'profile', icon: <UserIcon className="w-5 h-5" />, roles: ['admin', 'staff', 'inventory_manager'] },
];

const Sidebar: React.FC<SidebarProps> = ({ currentPage, setCurrentPage, user, onLogout, isOnline }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const navItems = ALL_NAV_ITEMS.filter(item => item.roles.includes(user.role));

    return (
        <aside className={`bg-gray-100 h-full min-h-0 flex flex-col transition-all duration-300 ease-in-out ${isExpanded ? 'w-64' : 'w-20'}`}>
            <div className="h-16 flex items-center px-6 overflow-hidden">
                <svg className="w-8 h-8 text-blue-600 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 21a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7zM9 5v2h6V5H9zm0 4v2h6V9H9zm0 4v2h6v-2H9z" />
                </svg>
                <span className={`ml-3 text-xl font-bold text-gray-800 whitespace-nowrap ${isExpanded ? 'inline' : 'hidden'}`}>SalePilot</span>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto overflow-x-hidden sidebar-scroll">
                {navItems.map(item => (
                    <a
                        key={item.name}
                        href="#"
                        onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(item.page);
                        }}
                        className={`flex items-center px-4 py-2.5 rounded-lg transition-colors duration-200 ${
                            currentPage === item.page
                                ? 'bg-blue-50 text-blue-600 font-semibold'
                                : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                        } ${!isExpanded && 'justify-center'}`}
                        title={isExpanded ? undefined : item.name}
                    >
                         <div className="flex-shrink-0">
                            {React.isValidElement(item.icon) && typeof item.icon.type !== 'string' ? (
                                item.icon
                            ) : (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    {item.icon}
                                </svg>
                            )}
                         </div>
                        <span className={`ml-4 whitespace-nowrap ${isExpanded ? 'inline' : 'hidden'}`}>{item.name}</span>
                    </a>
                ))}
            </nav>
            <div className="px-4 py-4">
                <div
                    onClick={() => setCurrentPage('profile')}
                    className={`p-2 rounded-lg cursor-pointer transition-colors ${currentPage === 'profile' ? 'bg-blue-50' : 'hover:bg-gray-200'}`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setCurrentPage('profile'); }}
                    aria-label="View your profile"
                    title={isExpanded ? undefined : `${user.name}\n${user.email}`}
                >
                    <div className={`flex items-center gap-3 ${!isExpanded && 'justify-center'}`}>
                        <div className="p-2 bg-gray-100 rounded-full flex-shrink-0">
                            <UserIcon className="w-6 h-6 text-gray-600"/>
                        </div>
                        <div className={`overflow-hidden ${isExpanded ? 'block' : 'hidden'}`}>
                            <p className="text-sm font-semibold text-gray-800 whitespace-nowrap">{user.name}</p>
                            <p className="text-xs text-gray-500 whitespace-nowrap">{user.email}</p>
                        </div>
                    </div>
                </div>
                <button
                    onClick={onLogout}
                    title={isExpanded ? undefined : 'Logout'}
                    className={`w-full mt-4 flex items-center px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors ${!isExpanded && 'justify-center'}`}
                >
                    <div className="flex-shrink-0">
                      <ArrowLeftOnRectangleIcon className="w-5 h-5"/>
                    </div>
                    <span className={`ml-3 whitespace-nowrap ${isExpanded ? 'inline' : 'hidden'}`}>Logout</span>
                </button>
                 <div className="mt-4 pt-4">
                     <div
                        className={`flex items-center justify-center gap-2 text-xs p-2 rounded-md ${isExpanded ? 'justify-start px-3' : 'justify-center'} ${isOnline ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-800'}`}
                        title={isOnline ? 'Connection is active.' : 'Application is in offline mode.'}
                    >
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                        <span className={`whitespace-nowrap ${isExpanded ? 'inline' : 'hidden'}`}>{isOnline ? 'Online' : 'Offline Mode'}</span>
                    </div>
                 </div>
                <div className="mt-2 flex justify-center">
                    <button 
                        onClick={() => setIsExpanded(prev => !prev)} 
                        className="p-2 rounded-full text-gray-500 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
                    >
                        <ChevronDoubleLeftIcon className={`w-5 h-5 transition-transform duration-300 ${!isExpanded && 'rotate-180'}`} />
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
