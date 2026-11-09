"use client";

import React, { useEffect } from 'react';
import { X, Package, Edit as EditIcon } from 'lucide-react';
import ProductForm from './ProductForm';
import { Product } from '@/app/_db/db';
import { PMScope, T } from '@/app/_components/_pmTheme';

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
  title,
}: ProductModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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
  const Icon = mode === 'create' ? Package : EditIcon;

  return (
    <PMScope className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 transition-opacity"
        style={{ background: T.backdrop }}
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div
          className="relative transform overflow-hidden rounded text-left transition-all sm:my-8 sm:w-full sm:max-w-3xl"
          style={{
            background: T.surface,
            border: `1px solid ${T.slate200}`,
            boxShadow: `0 20px 40px ${T.shadowStrong}`,
          }}
        >
          {/* Header */}
          <div
            className="px-5 py-3 flex justify-between items-center"
            style={{
              background: T.slate50,
              borderBottom: `1px solid ${T.slate200}`,
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="flex items-center justify-center h-8 w-8 rounded"
                style={{ background: T.accentFill, color: T.onAccentFill }}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div
                  className="text-[11px] font-bold uppercase tracking-[0.05em]"
                  style={{ color: T.slate500 }}
                >
                  {mode === 'create' ? 'Crear registro' : 'Editar registro'}
                </div>
                <h3
                  className="text-[16px] font-semibold leading-6"
                  style={{ color: T.headline }}
                >
                  {modalTitle}
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center h-8 w-8 rounded transition-colors"
              style={{ color: T.slate500 }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = T.slate100)
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')
              }
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div
            className="px-5 py-5 max-h-[80vh] overflow-y-auto"
            style={{ background: T.bg }}
          >
            <ProductForm
              product={product}
              mode={mode}
              onSubmit={onSubmit}
              onCancel={onClose}
            />
          </div>
        </div>
      </div>
    </PMScope>
  );
}
