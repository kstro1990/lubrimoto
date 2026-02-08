"use client";

import React, { useState, useEffect } from 'react';
import { Product, db, generateSKU, SyncStatus, recordInventoryMovement, MovementType } from '@/app/_db/db';
import { Package, DollarSign, Box, AlertCircle, Building2, Tag, MapPin, Barcode } from 'lucide-react';

interface ProductFormProps {
  product: Product | null | undefined;
  onSubmit: (product: Product) => void;
  onCancel: () => void;
  mode: 'create' | 'edit';
}

const CATEGORIES = [
  'Lubricantes',
  'Filtros',
  'Bujías',
  'Frenos',
  'Transmisión',
  'Neumáticos',
  'Baterías',
  'Accesorios',
  'Aditivos',
  'Líquidos',
  'Repuestos',
  'Herramientas',
  'Otro'
];

export default function ProductForm({ product, onSubmit, onCancel, mode }: ProductFormProps) {
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    description: '',
    sku: '',
    costUsd: undefined,
    priceUsd: 0,
    stockQuantity: 0,
    minStockAlert: 5,
    supplier: '',
    category: '',
    barcode: '',
    location: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isGeneratingSKU, setIsGeneratingSKU] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (product && mode === 'edit') {
      setFormData({
        name: product.name,
        description: product.description || '',
        sku: product.sku,
        costUsd: product.costUsd,
        priceUsd: product.priceUsd,
        stockQuantity: product.stockQuantity,
        minStockAlert: product.minStockAlert || 5,
        supplier: product.supplier || '',
        category: product.category || '',
        barcode: product.barcode || '',
        location: product.location || '',
      });
    } else if (mode === 'create') {
      // Auto-generate SKU for new products
      generateNewSKU();
    }
  }, [product, mode]);

  const generateNewSKU = async () => {
    setIsGeneratingSKU(true);
    try {
      const newSKU = await generateSKU();
      setFormData(prev => ({ ...prev, sku: newSKU }));
    } catch (error) {
      console.error('Error generating SKU:', error);
    } finally {
      setIsGeneratingSKU(false);
    }
  };

  const validateField = (name: string, value: any): string => {
    switch (name) {
      case 'name':
        if (!value || value.trim().length < 2) {
          return 'El nombre debe tener al menos 2 caracteres';
        }
        if (value.trim().length > 100) {
          return 'El nombre no puede exceder 100 caracteres';
        }
        return '';
      
      case 'sku':
        if (!value || value.trim().length < 3) {
          return 'El SKU debe tener al menos 3 caracteres';
        }
        return '';
      
      case 'priceUsd':
        if (!value || value <= 0) {
          return 'El precio debe ser mayor a 0';
        }
        return '';
      
      case 'costUsd':
        if (value !== undefined && value !== null && value < 0) {
          return 'El costo no puede ser negativo';
        }
        return '';
      
      case 'stockQuantity':
        if (value === undefined || value === null || value < 0) {
          return 'El stock no puede ser negativo';
        }
        return '';
      
      case 'minStockAlert':
        if (value !== undefined && value !== null && value < 0) {
          return 'La alerta de stock mínimo no puede ser negativa';
        }
        return '';
      
      default:
        return '';
    }
  };

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};
    
    const fieldsToValidate = ['name', 'sku', 'priceUsd', 'stockQuantity'];
    
    fieldsToValidate.forEach(field => {
      const value = formData[field as keyof typeof formData];
      const error = validateField(field, value);
      if (error) {
        newErrors[field] = error;
      }
    });

    // Check if SKU is unique (only for new products or if SKU changed)
    if (mode === 'create' || (product && formData.sku !== product.sku)) {
      try {
        const existing = await db.products.where('sku').equals(formData.sku || '').first();
        if (existing) {
          newErrors.sku = 'Este SKU ya existe';
        }
      } catch (error) {
        console.error('Error checking SKU uniqueness:', error);
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    let parsedValue: any = value;
    
    if (type === 'number') {
      parsedValue = value === '' ? undefined : parseFloat(value);
      if (isNaN(parsedValue)) parsedValue = 0;
    }
    
    setFormData(prev => ({ ...prev, [name]: parsedValue }));
    
    // Validate on change
    const error = validateField(name, parsedValue);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all fields as touched
    const allTouched: Record<string, boolean> = {};
    Object.keys(formData).forEach(key => {
      allTouched[key] = true;
    });
    setTouched(allTouched);
    
    // Wait for validation (including async SKU check)
    const isValid = await validateForm();
    if (!isValid) {
      console.log('Form validation failed:', errors);
      return;
    }

    const now = new Date();
    
    // Helper to convert empty strings to undefined
    const cleanString = (value: string | undefined): string | undefined => {
      if (!value || value.trim() === '') return undefined;
      return value.trim();
    };
    
    const productData: Product = {
      ...formData,
      name: formData.name!.trim(),
      sku: formData.sku!.trim().toUpperCase(),
      description: cleanString(formData.description),
      supplier: cleanString(formData.supplier),
      category: cleanString(formData.category),
      barcode: cleanString(formData.barcode),
      location: cleanString(formData.location),
      syncStatus: SyncStatus.PENDING,
      updatedAt: now,
      createdAt: mode === 'create' ? now : product!.createdAt,
      id: mode === 'edit' ? product!.id : undefined,
    } as Product;

    console.log('Submitting product:', productData);
    onSubmit(productData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Package className="h-5 w-5 mr-2" />
          Información Básica
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* SKU */}
          <div>
            <label htmlFor="sku" className="block text-sm font-medium text-gray-700">
              SKU <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <input
                type="text"
                name="sku"
                id="sku"
                value={formData.sku}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isGeneratingSKU}
                className={`flex-1 block w-full rounded-l-md border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 ${
                  errors.sku && touched.sku ? 'border-red-500' : ''
                }`}
                placeholder="PROD-XXXXXX"
              />
              {mode === 'create' && (
                <button
                  type="button"
                  onClick={generateNewSKU}
                  disabled={isGeneratingSKU}
                  className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-sm hover:bg-gray-100"
                >
                  {isGeneratingSKU ? '...' : 'Generar'}
                </button>
              )}
            </div>
            {errors.sku && touched.sku && (
              <p className="mt-1 text-sm text-red-600">{errors.sku}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              SKU único auto-generado. Puedes modificarlo si es necesario.
            </p>
          </div>

          {/* Name */}
          <div className="md:col-span-2">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Nombre del Producto <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              id="name"
              value={formData.name}
              onChange={handleChange}
              onBlur={handleBlur}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                errors.name && touched.name ? 'border-red-500' : ''
              }`}
              placeholder="Ej: Aceite de Motor 10W-40 1L"
            />
            {errors.name && touched.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="md:col-span-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Descripción
            </label>
            <textarea
              name="description"
              id="description"
              rows={2}
              value={formData.description}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Descripción detallada del producto..."
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700">
              <Tag className="h-4 w-4 inline mr-1" />
              Categoría
            </label>
            <select
              name="category"
              id="category"
              value={formData.category}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="">Seleccionar categoría...</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Barcode */}
          <div>
            <label htmlFor="barcode" className="block text-sm font-medium text-gray-700">
              <Barcode className="h-4 w-4 inline mr-1" />
              Código de Barras
            </label>
            <input
              type="text"
              name="barcode"
              id="barcode"
              value={formData.barcode}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Ej: 7501234567890"
            />
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <DollarSign className="h-5 w-5 mr-2" />
          Precios
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cost */}
          <div>
            <label htmlFor="costUsd" className="block text-sm font-medium text-gray-700">
              Costo (USD)
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                name="costUsd"
                id="costUsd"
                min="0"
                step="0.01"
                value={formData.costUsd || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`block w-full pl-7 pr-12 rounded-md border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  errors.costUsd && touched.costUsd ? 'border-red-500' : ''
                }`}
                placeholder="0.00"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">USD</span>
              </div>
            </div>
            {errors.costUsd && touched.costUsd && (
              <p className="mt-1 text-sm text-red-600">{errors.costUsd}</p>
            )}
          </div>

          {/* Price */}
          <div>
            <label htmlFor="priceUsd" className="block text-sm font-medium text-gray-700">
              Precio de Venta (USD) <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                name="priceUsd"
                id="priceUsd"
                min="0"
                step="0.01"
                required
                value={formData.priceUsd || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`block w-full pl-7 pr-12 rounded-md border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  errors.priceUsd && touched.priceUsd ? 'border-red-500' : ''
                }`}
                placeholder="0.00"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">USD</span>
              </div>
            </div>
            {errors.priceUsd && touched.priceUsd && (
              <p className="mt-1 text-sm text-red-600">{errors.priceUsd}</p>
            )}
          </div>

          {/* Margin indicator */}
          {formData.costUsd && formData.priceUsd && formData.costUsd > 0 && (
            <div className="md:col-span-2">
              <div className="flex items-center text-sm">
                <span className="text-gray-600">Margen de ganancia: </span>
                <span className={`ml-2 font-semibold ${
                  ((formData.priceUsd - formData.costUsd) / formData.priceUsd * 100) > 20 
                    ? 'text-green-600' 
                    : 'text-yellow-600'
                }`}>
                  {((formData.priceUsd - formData.costUsd) / formData.priceUsd * 100).toFixed(1)}%
                </span>
                <span className="mx-2 text-gray-400">|</span>
                <span className="text-gray-600">Ganancia: </span>
                <span className="ml-2 font-semibold text-green-600">
                  ${(formData.priceUsd - formData.costUsd).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inventory */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Box className="h-5 w-5 mr-2" />
          Inventario
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Stock Quantity */}
          <div>
            <label htmlFor="stockQuantity" className="block text-sm font-medium text-gray-700">
              Stock Actual <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="stockQuantity"
              id="stockQuantity"
              min="0"
              step="1"
              required
              value={formData.stockQuantity}
              onChange={handleChange}
              onBlur={handleBlur}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                errors.stockQuantity && touched.stockQuantity ? 'border-red-500' : ''
              }`}
            />
            {errors.stockQuantity && touched.stockQuantity && (
              <p className="mt-1 text-sm text-red-600">{errors.stockQuantity}</p>
            )}
          </div>

          {/* Min Stock Alert */}
          <div>
            <label htmlFor="minStockAlert" className="block text-sm font-medium text-gray-700">
              <AlertCircle className="h-4 w-4 inline mr-1" />
              Stock Mínimo
            </label>
            <input
              type="number"
              name="minStockAlert"
              id="minStockAlert"
              min="0"
              step="1"
              value={formData.minStockAlert}
              onChange={handleChange}
              onBlur={handleBlur}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Alerta cuando stock sea menor o igual a este valor
            </p>
          </div>

          {/* Location */}
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700">
              <MapPin className="h-4 w-4 inline mr-1" />
              Ubicación
            </label>
            <input
              type="text"
              name="location"
              id="location"
              value={formData.location}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Ej: Estante A-3"
            />
          </div>
        </div>
      </div>

      {/* Supplier */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Building2 className="h-5 w-5 mr-2" />
          Proveedor
        </h3>
        
        <div>
          <label htmlFor="supplier" className="block text-sm font-medium text-gray-700">
            Nombre del Proveedor
          </label>
          <input
            type="text"
            name="supplier"
            id="supplier"
            value={formData.supplier}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Ej: Proveedor A"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {mode === 'create' ? 'Crear Producto' : 'Guardar Cambios'}
        </button>
      </div>
    </form>
  );
}
