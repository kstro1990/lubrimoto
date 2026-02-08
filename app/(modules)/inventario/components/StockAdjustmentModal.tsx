"use client";

import React, { useState } from 'react';
import { X, Plus, Minus, AlertCircle } from 'lucide-react';
import { Product, db, recordInventoryMovement, MovementType, SyncStatus } from '@/app/_db/db';
import { useNotifications } from '@/app/_components/NotificationProvider';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSuccess?: () => void;
}

export default function StockAdjustmentModal({ 
  isOpen, 
  onClose, 
  product, 
  onSuccess 
}: StockAdjustmentModalProps) {
  const { success, error: showError } = useNotifications();
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract' | 'set'>('add');
  const [quantity, setQuantity] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (quantity <= 0) {
      showError('Error', 'La cantidad debe ser mayor a 0', 3000);
      return;
    }

    setIsSubmitting(true);
    
    try {
      let newStock = product.stockQuantity;
      let movementQuantity = quantity;
      let movementType: MovementType;
      
      switch (adjustmentType) {
        case 'add':
          newStock = product.stockQuantity + quantity;
          movementType = MovementType.PURCHASE;
          break;
        case 'subtract':
          if (quantity > product.stockQuantity) {
            showError('Error', 'No puedes restar más del stock disponible', 3000);
            setIsSubmitting(false);
            return;
          }
          newStock = product.stockQuantity - quantity;
          movementQuantity = -quantity;
          movementType = MovementType.ADJUSTMENT;
          break;
        case 'set':
          movementQuantity = quantity - product.stockQuantity;
          movementType = MovementType.ADJUSTMENT;
          newStock = quantity;
          break;
      }

      const now = new Date();
      
      // Update product stock
      await db.products.update(product.id!, {
        stockQuantity: newStock,
        updatedAt: now,
        syncStatus: SyncStatus.PENDING,
      });

      // Record movement
      const updatedProduct = { ...product, stockQuantity: newStock };
      await recordInventoryMovement(
        updatedProduct,
        movementType,
        movementQuantity,
        undefined,
        notes || `Ajuste de stock: ${adjustmentType === 'add' ? '+' : adjustmentType === 'subtract' ? '-' : '='} ${quantity}`,
        'Usuario' // TODO: Get from auth context
      );

      success(
        'Stock Actualizado',
        `Stock de "${product.name}" actualizado de ${product.stockQuantity} a ${newStock}`,
        4000
      );

      // Reset form
      setQuantity(0);
      setNotes('');
      setAdjustmentType('add');
      
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Error adjusting stock:', err);
      showError('Error', 'No se pudo actualizar el stock', 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getNewStockDisplay = () => {
    switch (adjustmentType) {
      case 'add':
        return product.stockQuantity + quantity;
      case 'subtract':
        return Math.max(0, product.stockQuantity - quantity);
      case 'set':
        return quantity;
      default:
        return product.stockQuantity;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />
        
        {/* Modal */}
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all w-full max-w-md">
          {/* Header */}
          <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Ajustar Stock
              </h3>
              <p className="text-sm text-gray-500">{product.name}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6">
            {/* Current Stock */}
            <div className="mb-6 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                Stock Actual: <span className="font-bold text-lg">{product.stockQuantity}</span> unidades
              </p>
            </div>

            {/* Adjustment Type */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Ajuste
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustmentType('add')}
                  className={`flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    adjustmentType === 'add'
                      ? 'bg-green-100 text-green-700 border-2 border-green-500'
                      : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                  }`}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentType('subtract')}
                  className={`flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    adjustmentType === 'subtract'
                      ? 'bg-red-100 text-red-700 border-2 border-red-500'
                      : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                  }`}
                >
                  <Minus className="h-4 w-4 mr-1" />
                  Restar
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentType('set')}
                  className={`flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    adjustmentType === 'set'
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                      : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                  }`}
                >
                  Establecer
                </button>
              </div>
            </div>

            {/* Quantity */}
            <div className="mb-4">
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                Cantidad
              </label>
              <input
                type="number"
                id="quantity"
                min="0"
                step="1"
                value={quantity || ''}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="0"
                required
              />
            </div>

            {/* Preview */}
            {quantity > 0 && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  Nuevo stock será: <span className="font-bold text-lg">{getNewStockDisplay()}</span>
                </p>
                {adjustmentType === 'subtract' && quantity > product.stockQuantity && (
                  <p className="text-sm text-red-600 mt-1 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    No puedes restar más del stock disponible
                  </p>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="mb-6">
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notas (opcional)
              </label>
              <textarea
                id="notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Motivo del ajuste..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || quantity <= 0 || (adjustmentType === 'subtract' && quantity > product.stockQuantity)}
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Actualizando...' : 'Aplicar Ajuste'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
