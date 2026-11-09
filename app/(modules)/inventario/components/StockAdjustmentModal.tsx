"use client";

import React, { useState } from 'react';
import { X, Plus, Minus, AlertCircle, Package, ArrowRight } from 'lucide-react';
import { Product, db, recordInventoryMovement, MovementType, SyncStatus } from '@/app/_db/db';
import { useNotifications } from '@/app/_components/NotificationProvider';
import { PMScope, T, PMBtnPrimary, PMBtnSecondary } from '@/app/_components/_pmTheme';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSuccess?: () => void;
}

type AdjustmentType = 'add' | 'subtract' | 'set';

export default function StockAdjustmentModal({
  isOpen,
  onClose,
  product,
  onSuccess,
}: StockAdjustmentModalProps) {
  const { success, error: showError } = useNotifications();
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('add');
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

      await db.products.update(product.id!, {
        stockQuantity: newStock,
        updatedAt: now,
        syncStatus: SyncStatus.PENDING,
      });

      const updatedProduct = { ...product, stockQuantity: newStock };
      await recordInventoryMovement(
        updatedProduct,
        movementType,
        movementQuantity,
        undefined,
        notes ||
          `Ajuste de stock: ${
            adjustmentType === 'add' ? '+' : adjustmentType === 'subtract' ? '-' : '='
          } ${quantity}`,
        'Usuario',
      );

      success(
        'Stock Actualizado',
        `Stock de "${product.name}" actualizado de ${product.stockQuantity} a ${newStock}`,
        4000,
      );

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

  const overSubtract =
    adjustmentType === 'subtract' && quantity > product.stockQuantity;

  return (
    <PMScope className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="fixed inset-0 transition-opacity"
          style={{ background: T.backdrop }}
          onClick={onClose}
        />

        <div
          className="relative transform overflow-hidden rounded text-left transition-all w-full max-w-md"
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
                <Package className="h-4 w-4" />
              </div>
              <div>
                <div
                  className="text-[11px] font-bold uppercase tracking-[0.05em]"
                  style={{ color: T.slate500 }}
                >
                  Movimiento de stock
                </div>
                <h3
                  className="text-[16px] font-semibold leading-5"
                  style={{ color: T.headline }}
                >
                  Ajustar Stock
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
              <X className="h-4 w-4" />
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-5"
            style={{ background: T.bg }}
          >
            {/* Product summary */}
            <div
              className="mb-5 px-4 py-3 rounded flex items-center justify-between"
              style={{
                background: T.surface,
                border: `1px solid ${T.slate200}`,
              }}
            >
              <div className="min-w-0">
                <div
                  className="text-[11px] font-bold uppercase tracking-[0.05em]"
                  style={{ color: T.slate500 }}
                >
                  Producto
                </div>
                <div
                  className="font-semibold text-[14px] truncate"
                  style={{ color: T.charcoal }}
                >
                  {product.name}
                </div>
                <div
                  className="font-mono text-[12px] mt-0.5"
                  style={{ color: T.slate500 }}
                >
                  {product.sku}
                </div>
              </div>
              <div className="text-right pl-4">
                <div
                  className="text-[11px] font-bold uppercase tracking-[0.05em]"
                  style={{ color: T.slate500 }}
                >
                  Stock actual
                </div>
                <div
                  className="pm-tnum font-bold text-[24px] leading-7"
                  style={{ color: T.charcoal }}
                >
                  {product.stockQuantity}
                </div>
              </div>
            </div>

            {/* Adjustment Type */}
            <div className="mb-4">
              <label className="pm-label">Tipo de Ajuste</label>
              <div className="grid grid-cols-3 gap-2">
                <AdjustmentButton
                  active={adjustmentType === 'add'}
                  onClick={() => setAdjustmentType('add')}
                  tone="add"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar
                </AdjustmentButton>
                <AdjustmentButton
                  active={adjustmentType === 'subtract'}
                  onClick={() => setAdjustmentType('subtract')}
                  tone="subtract"
                >
                  <Minus className="h-3.5 w-3.5" />
                  Restar
                </AdjustmentButton>
                <AdjustmentButton
                  active={adjustmentType === 'set'}
                  onClick={() => setAdjustmentType('set')}
                  tone="set"
                >
                  Establecer
                </AdjustmentButton>
              </div>
            </div>

            {/* Quantity */}
            <div className="mb-4">
              <label htmlFor="quantity" className="pm-label">
                Cantidad
              </label>
              <input
                type="number"
                id="quantity"
                min="0"
                step="1"
                value={quantity || ''}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                className="pm-input pm-tnum"
                placeholder="0"
                required
              />
            </div>

            {/* Preview */}
            {quantity > 0 && (
              <div
                className="mb-4 px-4 py-3 rounded flex items-center gap-3"
                style={{
                  background: T.surface,
                  border: `1px solid ${T.slate200}`,
                }}
              >
                <div className="flex-1">
                  <div
                    className="text-[11px] font-bold uppercase tracking-[0.05em]"
                    style={{ color: T.slate500 }}
                  >
                    Nuevo stock
                  </div>
                  <div
                    className="pm-tnum font-bold text-[20px] leading-7"
                    style={{ color: overSubtract ? T.red : T.charcoal }}
                  >
                    <span style={{ color: T.slate400 }}>{product.stockQuantity}</span>
                    <ArrowRight
                      className="inline h-4 w-4 mx-2"
                      style={{ color: T.slate400 }}
                    />
                    {getNewStockDisplay()}
                  </div>
                </div>
                {overSubtract && (
                  <div
                    className="flex items-center gap-1 text-[12px]"
                    style={{ color: T.red }}
                  >
                    <AlertCircle className="h-4 w-4" />
                    Excede el stock disponible
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="mb-5">
              <label htmlFor="notes" className="pm-label">
                Notas (opcional)
              </label>
              <textarea
                id="notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="pm-input"
                placeholder="Motivo del ajuste…"
              />
            </div>

            {/* Actions */}
            <div
              className="flex justify-end gap-2 pt-3"
              style={{ borderTop: `1px solid ${T.slate200}` }}
            >
              <PMBtnSecondary type="button" onClick={onClose}>
                Cancelar
              </PMBtnSecondary>
              <PMBtnPrimary
                type="submit"
                disabled={isSubmitting || quantity <= 0 || overSubtract}
              >
                {isSubmitting ? 'Actualizando…' : 'Aplicar Ajuste'}
              </PMBtnPrimary>
            </div>
          </form>
        </div>
      </div>
    </PMScope>
  );
}

function AdjustmentButton({
  active,
  onClick,
  tone,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone: 'add' | 'subtract' | 'set';
  children: React.ReactNode;
}) {
  const activeColor =
    tone === 'add' ? T.green : tone === 'subtract' ? T.red : T.orange;
  const activeBg =
    tone === 'add'
      ? T.greenSoft
      : tone === 'subtract'
      ? T.redSoft
      : T.orangeSoft;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 px-2 h-9 text-[13px] font-semibold rounded transition-colors"
      style={{
        background: active ? activeBg : T.surface,
        color: active ? activeColor : T.charcoal,
        border: `1px solid ${active ? activeColor : T.slate300}`,
      }}
    >
      {children}
    </button>
  );
}
