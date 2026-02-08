"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus } from 'lucide-react';
import ProductForm from '../components/ProductForm';
import { Product, db, SyncStatus, recordInventoryMovement, MovementType } from '@/app/_db/db';
import { useNotifications } from '@/app/_components/NotificationProvider';
import Link from 'next/link';

export default function NewProductPage() {
  const router = useRouter();
  const { success, error: showError } = useNotifications();

  const handleSubmit = async (productData: Product) => {
    console.log('handleSubmit called with:', productData);
    
    try {
      // Double-check if SKU already exists (safety check)
      console.log('Checking if SKU exists:', productData.sku);
      const existing = await db.products.where('sku').equals(productData.sku).first();
      
      if (existing) {
        console.log('SKU already exists:', existing);
        showError('Error', `El SKU "${productData.sku}" ya existe. Por favor usa otro.`, 5000);
        return;
      }

      console.log('SKU is unique, proceeding to add product...');
      
      // Add product - Ensure all required fields are present
      const productToAdd = {
        ...productData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      console.log('Adding product to database:', productToAdd);
      const id = await db.products.add(productToAdd);
      console.log('Product added successfully with ID:', id);
      
      // Verify product was added
      const addedProduct = await db.products.get(id);
      console.log('Verified product in database:', addedProduct);
      
      // Record initial stock movement
      console.log('Recording inventory movement...');
      await recordInventoryMovement(
        { ...productToAdd, id },
        MovementType.INITIAL,
        productData.stockQuantity,
        undefined,
        'Producto creado',
        'Usuario'
      );
      console.log('Inventory movement recorded');

      success(
        'Producto Creado',
        `"${productData.name}" ha sido agregado al inventario exitosamente`,
        4000
      );

      router.push('/inventario');
    } catch (err: any) {
      console.error('Error creating product:', err);
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        productData: productData
      });
      showError('Error', `No se pudo crear el producto: ${err.message || 'Error desconocido'}`, 5000);
    }
  };

  const handleCancel = () => {
    router.push('/inventario');
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/inventario"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver al Inventario
        </Link>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Plus className="h-8 w-8 mr-3 text-blue-600" />
              Nuevo Producto
            </h1>
            <p className="text-gray-600 mt-1">
              Completa la información del producto para agregarlo al inventario
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <ProductForm
          product={undefined}
          mode="create"
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </div>

      {/* Tips */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Consejos:</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>El SKU se genera automáticamente, pero puedes modificarlo si es necesario</li>
          <li>Usa categorías consistentes para facilitar la búsqueda</li>
          <li>El stock mínimo te ayudará a recibir alertas cuando el inventario esté bajo</li>
          <li>El código de barras es opcional pero útil para escanear productos rápidamente</li>
        </ul>
      </div>
    </div>
  );
}
