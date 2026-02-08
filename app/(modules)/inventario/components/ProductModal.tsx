"use client";

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import ProductForm from './ProductForm';
import { Product } from '@/app/_db/db';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  mode: 'create' | 'edit';
  onSubmit: (product: Product) => void;
  title?: string;
}

export default function ProductModal({ 
  isOpen, 
  onClose, 
  product, 
  mode, 
  onSubmit,
  title 
}: ProductModalProps) {
  
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalTitle = title || (mode === 'create' ? 'Nuevo Producto' : 'Editar Producto');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl">
          {/* Header */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-between items-center border-b">
            <h3 className="text-lg font-semibold leading-6 text-gray-900">
              {modalTitle}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          {/* Content */}
          <div className="px-4 py-5 sm:p-6 max-h-[80vh] overflow-y-auto">
            <ProductForm
              product={product}
              mode={mode}
              onSubmit={onSubmit}
              onCancel={onClose}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
