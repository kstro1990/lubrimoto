"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Lightbulb } from 'lucide-react';
import ProductForm from '../components/ProductForm';
import { Product, db, MovementType } from '@/app/_db/db';
import { useNotifications } from '@/app/_components/NotificationProvider';
import Link from 'next/link';
import { TOKENS } from '@/app/_components/_pmTheme';

export default function NewProductPage() {
  const router = useRouter();
  const { success, error: showError } = useNotifications();

  const handleSubmit = async (productData: Product) => {
    try {
      await db.transaction('rw', db.products, db.inventoryMovements, async () => {
        const existing = await db.products.where('sku').equals(productData.sku).first();
        if (existing) {
          throw new Error(`El SKU "${productData.sku}" ya existe. Por favor usa otro.`);
        }

        const productToAdd = {
          ...productData,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const id = await db.products.add(productToAdd);

        const addedProduct = await db.products.get(id);
        if (!addedProduct) {
          throw new Error('El producto no se pudo guardar correctamente.');
        }

        await db.inventoryMovements.add({
          productId: id,
          productSku: productToAdd.sku,
          productName: productToAdd.name,
          type: MovementType.INITIAL,
          quantity: productData.stockQuantity,
          previousStock: 0,
          newStock: productData.stockQuantity,
          notes: 'Producto creado',
          createdBy: 'Usuario',
          createdAt: new Date(),
        });

        return { id, product: addedProduct };
      });

      success(
        'Producto Creado',
        `"${productData.name}" ha sido agregado al inventario exitosamente`,
        4000,
      );

      router.push('/inventario');
    } catch (err: any) {
      const errorMessage = err.message || 'Error desconocido al crear el producto';
      showError('Error', `No se pudo crear el producto: ${errorMessage}`, 5000);
    }
  };

  const handleCancel = () => {
    router.push('/inventario');
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-[960px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-5">
          <Link
            href="/inventario"
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold mb-3 transition-colors"
            style={{ color: TOKENS.slate500 }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al Inventario
          </Link>

          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center h-9 w-9 rounded"
              style={{ background: TOKENS.charcoal, color: '#fff' }}
            >
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <div className="pm-eyebrow mb-0.5">Operaciones / Inventario</div>
              <h1
                className="text-[24px] font-bold leading-8 tracking-[-0.02em]"
                style={{ color: TOKENS.charcoal }}
              >
                Nuevo Producto
              </h1>
              <p className="text-[13px]" style={{ color: TOKENS.slate500 }}>
                Completa la información para agregarlo al inventario.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="pm-card p-5 mb-4">
          <ProductForm
            product={undefined}
            mode="create"
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </div>

        {/* Tips */}
        <div
          className="rounded p-4 flex items-start gap-3"
          style={{
            background: TOKENS.slate50,
            border: `1px solid ${TOKENS.slate200}`,
            borderLeft: `3px solid ${TOKENS.orange}`,
          }}
        >
          <Lightbulb className="h-4 w-4 shrink-0 mt-0.5" style={{ color: TOKENS.orange }} />
          <div>
            <div className="pm-eyebrow mb-1">Consejos</div>
            <ul className="text-[13px] space-y-1" style={{ color: TOKENS.slate700 }}>
              <li>
                El SKU se genera automáticamente, pero puedes modificarlo si es necesario.
              </li>
              <li>Usa categorías consistentes para facilitar la búsqueda.</li>
              <li>
                El stock mínimo te ayudará a recibir alertas cuando el inventario esté bajo.
              </li>
              <li>
                El código de barras es opcional pero útil para escanear productos
                rápidamente.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
