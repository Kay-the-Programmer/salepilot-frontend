import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import XMarkIcon from './icons/XMarkIcon';

interface StockAdjustmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (productId: string, newQuantity: number, reason: string) => void;
    product: Product | null;
}

const adjustmentReasons = [
    "Receiving Stock",
    "Stock Count",
    "Damaged Goods",
    "Theft",
    "Return",
    "Other",
];

const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({ isOpen, onClose, onSave, product }) => {
    const [newQuantity, setNewQuantity] = useState<number | string>('');
    const [reason, setReason] = useState(adjustmentReasons[0]);
    
    useEffect(() => {
        if (product) {
            setNewQuantity(product.stock);
            setReason(adjustmentReasons[0]);
        }
    }, [product]);

    if (!isOpen || !product) return null;

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        const quantity = typeof newQuantity === 'string' ? parseInt(newQuantity, 10) : newQuantity;
        if (!isNaN(quantity) && quantity >= 0) {
            onSave(product.id, quantity, reason);
            onClose();
        }
    };
    
    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50 transition-opacity" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <form onSubmit={handleSave} className="bg-white rounded-lg shadow-xl transform transition-all sm:max-w-md w-full m-4">
                <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4 flex justify-between items-start border-b">
                    <div>
                        <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                            Adjust Stock
                        </h3>
                         <p className="text-sm text-gray-500 mt-1">{product.name}</p>
                    </div>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-500">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-600">Current stock on hand: <span className="font-semibold text-gray-800 text-base">{product.stock}</span></p>
                    <div>
                        <label htmlFor="newQuantity" className="block text-sm font-medium text-gray-700">New Quantity *</label>
                        <input 
                            type="number" 
                            name="newQuantity" 
                            id="newQuantity"
                            value={newQuantity}
                            onChange={(e) => setNewQuantity(e.target.value)}
                            min="0"
                            step="1"
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            required
                        />
                    </div>
                     <div>
                        <label htmlFor="reason" className="block text-sm font-medium text-gray-700">Reason for Adjustment *</label>
                        <select 
                            id="reason" 
                            name="reason" 
                            value={reason} 
                            onChange={(e) => setReason(e.target.value)}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                        >
                            {adjustmentReasons.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                     </div>
                </div>

                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t">
                    <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50" disabled={newQuantity === '' || Number(newQuantity) < 0}>
                        Update Stock
                    </button>
                    <button type="button" onClick={onClose} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm">
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

export default StockAdjustmentModal;
