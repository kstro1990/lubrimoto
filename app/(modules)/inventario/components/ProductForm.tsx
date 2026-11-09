"use client";

import React, { useState, useEffect } from 'react';
import { Product, db, generateSKU, SyncStatus } from '@/app/_db/db';
import { Package, DollarSign, Box, AlertCircle, Building2, Tag, MapPin, Barcode } from 'lucide-react';
import { T, PMBtnPrimary, PMBtnSecondary } from '@/app/_components/_pmTheme';

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
  'Otro',
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
      generateNewSKU();
    }
  }, [product, mode]);

  const generateNewSKU = async () => {
    setIsGeneratingSKU(true);
    try {
      const newSKU = await generateSKU();
      setFormData((prev) => ({ ...prev, sku: newSKU }));
      setErrors((prev) => ({ ...prev, sku: '' }));
    } catch (error) {
      console.error('Error generating SKU:', error);
      setErrors((prev) => ({
        ...prev,
        sku: 'Error al generar SKU. Por favor inténtalo de nuevo o ingresa uno manualmente.',
      }));
    } finally {
      setIsGeneratingSKU(false);
    }
  };

  const validateField = (name: string, value: any): string => {
    switch (name) {
      case 'name':
        if (!value || value.trim().length < 2) return 'El nombre debe tener al menos 2 caracteres';
        if (value.trim().length > 100) return 'El nombre no puede exceder 100 caracteres';
        return '';
      case 'sku':
        if (!value || value.trim().length < 3) return 'El SKU debe tener al menos 3 caracteres';
        return '';
      case 'priceUsd':
        if (!value || value <= 0) return 'El precio debe ser mayor a 0';
        return '';
      case 'costUsd':
        if (value !== undefined && value !== null && value < 0) return 'El costo no puede ser negativo';
        return '';
      case 'stockQuantity':
        if (value === undefined || value === null || value < 0) return 'El stock no puede ser negativo';
        return '';
      case 'minStockAlert':
        if (value !== undefined && value !== null && value < 0)
          return 'La alerta de stock mínimo no puede ser negativa';
        return '';
      default:
        return '';
    }
  };

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};
    const fieldsToValidate = ['name', 'sku', 'priceUsd', 'stockQuantity'];

    fieldsToValidate.forEach((field) => {
      const value = formData[field as keyof typeof formData];
      const error = validateField(field, value);
      if (error) newErrors[field] = error;
    });

    if (!formData.sku || formData.sku.trim() === '') {
      newErrors.sku = 'El SKU es requerido. Haz clic en "Generar" para crear uno automáticamente.';
    }

    if (!newErrors.sku && (mode === 'create' || (product && formData.sku !== product.sku))) {
      try {
        const existing = await db.products.where('sku').equals(formData.sku || '').first();
        if (existing) {
          newErrors.sku = 'Este SKU ya existe. Por favor genera uno nuevo o usa uno diferente.';
        }
      } catch (error) {
        console.error('Error checking SKU uniqueness:', error);
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    let parsedValue: any = value;
    if (type === 'number') {
      parsedValue = value === '' ? undefined : parseFloat(value);
      if (isNaN(parsedValue)) parsedValue = 0;
    }
    setFormData((prev) => ({ ...prev, [name]: parsedValue }));
    const error = validateField(name, parsedValue);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const allTouched: Record<string, boolean> = {};
    Object.keys(formData).forEach((key) => {
      allTouched[key] = true;
    });
    setTouched(allTouched);

    const isValid = await validateForm();
    if (!isValid) {
      const firstErrorField = Object.keys(errors).find((key) => errors[key]);
      if (firstErrorField) {
        const element = document.getElementById(firstErrorField);
        element?.focus();
      }
      return;
    }

    const now = new Date();

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

    if (process.env.NODE_ENV === 'development') {
      console.log('Submitting product:', productData);
    }

    onSubmit(productData);
  };

  const fieldErrCls = (field: string) =>
    errors[field] && touched[field] ? 'pm-input pm-input-error' : 'pm-input';

  const margin =
    formData.costUsd && formData.priceUsd && formData.costUsd > 0
      ? ((formData.priceUsd - formData.costUsd) / formData.priceUsd) * 100
      : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Basic Information */}
      <section className="pm-section">
        <h3 className="pm-section-title">
          <Package className="h-4 w-4" style={{ color: T.slate500 }} />
          Información Básica
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* SKU */}
          <div>
            <label htmlFor="sku" className="pm-label">
              SKU <span style={{ color: T.red }}>*</span>
            </label>
            <div className="flex">
              <input
                type="text"
                name="sku"
                id="sku"
                value={formData.sku}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isGeneratingSKU}
                className={fieldErrCls('sku')}
                style={{
                  borderTopRightRadius: mode === 'create' ? 0 : undefined,
                  borderBottomRightRadius: mode === 'create' ? 0 : undefined,
                  borderRight: mode === 'create' ? 'none' : undefined,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}
                placeholder="PROD-XXXXXX"
              />
              {mode === 'create' && (
                <button
                  type="button"
                  onClick={generateNewSKU}
                  disabled={isGeneratingSKU}
                  className="inline-flex items-center px-3 text-[12px] font-semibold transition-colors"
                  style={{
                    background: T.slate100,
                    color: T.charcoal,
                    border: `1px solid ${T.slate300}`,
                    borderTopRightRadius: '0.25rem',
                    borderBottomRightRadius: '0.25rem',
                  }}
                >
                  {isGeneratingSKU ? '…' : 'Generar'}
                </button>
              )}
            </div>
            {errors.sku && touched.sku ? (
              <p className="pm-error">{errors.sku}</p>
            ) : (
              <p className="pm-hint">SKU único auto-generado. Puedes modificarlo si es necesario.</p>
            )}
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="pm-label">
              <Tag className="h-3 w-3 inline mr-1" />
              Categoría
            </label>
            <select
              name="category"
              id="category"
              value={formData.category}
              onChange={handleChange}
              className="pm-input"
            >
              <option value="">Seleccionar categoría…</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div className="md:col-span-2">
            <label htmlFor="name" className="pm-label">
              Nombre del Producto <span style={{ color: T.red }}>*</span>
            </label>
            <input
              type="text"
              name="name"
              id="name"
              value={formData.name}
              onChange={handleChange}
              onBlur={handleBlur}
              className={fieldErrCls('name')}
              placeholder="Ej: Aceite de Motor 10W-40 1L"
            />
            {errors.name && touched.name && <p className="pm-error">{errors.name}</p>}
          </div>

          {/* Description */}
          <div className="md:col-span-2">
            <label htmlFor="description" className="pm-label">
              Descripción
            </label>
            <textarea
              name="description"
              id="description"
              rows={2}
              value={formData.description}
              onChange={handleChange}
              className="pm-input"
              placeholder="Descripción detallada del producto…"
            />
          </div>

          {/* Barcode */}
          <div className="md:col-span-2">
            <label htmlFor="barcode" className="pm-label">
              <Barcode className="h-3 w-3 inline mr-1" />
              Código de Barras
            </label>
            <input
              type="text"
              name="barcode"
              id="barcode"
              value={formData.barcode}
              onChange={handleChange}
              className="pm-input"
              placeholder="Ej: 7501234567890"
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="pm-section">
        <h3 className="pm-section-title">
          <DollarSign className="h-4 w-4" style={{ color: T.slate500 }} />
          Precios
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cost */}
          <div>
            <label htmlFor="costUsd" className="pm-label">
              Costo (USD)
            </label>
            <MoneyInput
              name="costUsd"
              id="costUsd"
              value={formData.costUsd}
              onChange={handleChange}
              onBlur={handleBlur}
              hasError={!!(errors.costUsd && touched.costUsd)}
            />
            {errors.costUsd && touched.costUsd && <p className="pm-error">{errors.costUsd}</p>}
          </div>

          {/* Price */}
          <div>
            <label htmlFor="priceUsd" className="pm-label">
              Precio de Venta (USD) <span style={{ color: T.red }}>*</span>
            </label>
            <MoneyInput
              name="priceUsd"
              id="priceUsd"
              value={formData.priceUsd}
              onChange={handleChange}
              onBlur={handleBlur}
              required
              hasError={!!(errors.priceUsd && touched.priceUsd)}
            />
            {errors.priceUsd && touched.priceUsd && (
              <p className="pm-error">{errors.priceUsd}</p>
            )}
          </div>

          {/* Margin indicator */}
          {margin !== null && (
            <div className="md:col-span-2">
              <div
                className="flex items-center gap-3 px-3 py-2 rounded"
                style={{
                  background: T.slate50,
                  border: `1px solid ${T.slate200}`,
                }}
              >
                <div>
                  <div
                    className="text-[11px] font-bold uppercase tracking-[0.05em]"
                    style={{ color: T.slate500 }}
                  >
                    Margen
                  </div>
                  <div
                    className="pm-tnum font-bold text-[16px]"
                    style={{ color: margin > 20 ? T.green : T.amber }}
                  >
                    {margin.toFixed(1)}%
                  </div>
                </div>
                <div className="h-8 w-px" style={{ background: T.slate200 }} />
                <div>
                  <div
                    className="text-[11px] font-bold uppercase tracking-[0.05em]"
                    style={{ color: T.slate500 }}
                  >
                    Ganancia
                  </div>
                  <div
                    className="pm-tnum font-bold text-[16px]"
                    style={{ color: T.charcoal }}
                  >
                    ${(formData.priceUsd! - formData.costUsd!).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Inventory */}
      <section className="pm-section">
        <h3 className="pm-section-title">
          <Box className="h-4 w-4" style={{ color: T.slate500 }} />
          Inventario
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="stockQuantity" className="pm-label">
              Stock Actual <span style={{ color: T.red }}>*</span>
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
              className={`${fieldErrCls('stockQuantity')} pm-tnum`}
            />
            {errors.stockQuantity && touched.stockQuantity && (
              <p className="pm-error">{errors.stockQuantity}</p>
            )}
          </div>

          <div>
            <label htmlFor="minStockAlert" className="pm-label">
              <AlertCircle className="h-3 w-3 inline mr-1" />
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
              className="pm-input pm-tnum"
            />
            <p className="pm-hint">Alerta cuando stock sea menor o igual a este valor</p>
          </div>

          <div>
            <label htmlFor="location" className="pm-label">
              <MapPin className="h-3 w-3 inline mr-1" />
              Ubicación
            </label>
            <input
              type="text"
              name="location"
              id="location"
              value={formData.location}
              onChange={handleChange}
              className="pm-input"
              placeholder="Ej: Estante A-3"
            />
          </div>
        </div>
      </section>

      {/* Supplier */}
      <section className="pm-section">
        <h3 className="pm-section-title">
          <Building2 className="h-4 w-4" style={{ color: T.slate500 }} />
          Proveedor
        </h3>

        <div>
          <label htmlFor="supplier" className="pm-label">
            Nombre del Proveedor
          </label>
          <input
            type="text"
            name="supplier"
            id="supplier"
            value={formData.supplier}
            onChange={handleChange}
            className="pm-input"
            placeholder="Ej: Proveedor A"
          />
        </div>
      </section>

      {/* Actions */}
      <div
        className="flex justify-end gap-2 pt-3"
        style={{ borderTop: `1px solid ${T.slate200}` }}
      >
        <PMBtnSecondary type="button" onClick={onCancel}>
          Cancelar
        </PMBtnSecondary>
        <PMBtnPrimary type="submit">
          {mode === 'create' ? 'Crear Producto' : 'Guardar Cambios'}
        </PMBtnPrimary>
      </div>
    </form>
  );
}

function MoneyInput({
  name,
  id,
  value,
  onChange,
  onBlur,
  required,
  hasError,
}: {
  name: string;
  id: string;
  value: number | undefined;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  required?: boolean;
  hasError?: boolean;
}) {
  return (
    <div className="relative">
      <span
        className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-[13px] pointer-events-none"
        style={{ color: T.slate500 }}
      >
        $
      </span>
      <input
        type="number"
        name={name}
        id={id}
        min="0"
        step="0.01"
        required={required}
        value={value ?? ''}
        onChange={onChange}
        onBlur={onBlur}
        className={`pm-tnum ${hasError ? 'pm-input pm-input-error' : 'pm-input'}`}
        placeholder="0.00"
        style={{ paddingLeft: '1.5rem', paddingRight: '3rem' }}
      />
      <span
        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[11px] font-bold uppercase tracking-wider pointer-events-none"
        style={{ color: T.slate400 }}
      >
        USD
      </span>
    </div>
  );
}
