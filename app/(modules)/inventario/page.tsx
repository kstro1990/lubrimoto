"use client";

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Product, SyncStatus, generateSKU, recordInventoryMovement, MovementType } from '@/app/_db/db';
import ProductSearch from '@/app/_components/ui/ProductSearch';
import ProductModal from './components/ProductModal';
import StockAdjustmentModal from './components/StockAdjustmentModal';
import ImportModal from './components/ImportModal';
import { useNotifications } from '@/app/_components/NotificationProvider';
import Link from 'next/link';
import {
  Plus,
  Edit,
  Copy,
  Package,
  History,
  Upload,
  Trash2,
  MoreVertical,
  MinusCircle,
} from 'lucide-react';
import { T, PM_FONT } from '@/app/_components/_pmTheme';

export default function InventarioPage() {
  const { success, error: showError } = useNotifications();
  const [filteredProducts, setFilteredProducts] = useState<Product[] | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [productModalMode, setProductModalMode] = useState<'create' | 'edit'>('create');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const allProducts = useLiveQuery(() => db.products.orderBy('name').toArray(), []);
  const products = filteredProducts !== null ? filteredProducts : allProducts;

  const getSyncStatusBadge = (status?: SyncStatus) => {
    const base =
      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider';
    switch (status) {
      case SyncStatus.SYNCED:
        return (
          <span
            className={base}
            style={{ background: T.greenSoft, color: T.green }}
          >
            Sincronizado
          </span>
        );
      case SyncStatus.PENDING:
        return (
          <span
            className={base}
            style={{ background: T.amberSoft, color: T.amber }}
          >
            Pendiente
          </span>
        );
      case SyncStatus.SYNCING:
        return (
          <span
            className={base}
            style={{ background: T.slate100, color: T.charcoal }}
          >
            <span
              className="inline-block w-2 h-2 rounded-full animate-pulse"
              style={{ background: T.charcoal }}
            />
            Sincronizando
          </span>
        );
      case SyncStatus.ERROR:
        return (
          <span
            className={base}
            style={{ background: T.redSoft, color: T.orange }}
          >
            Error
          </span>
        );
      default:
        return (
          <span
            className={base}
            style={{ background: T.slate100, color: T.slate500 }}
          >
            -
          </span>
        );
    }
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setProductModalMode('edit');
    setIsProductModalOpen(true);
    setOpenDropdown(null);
  };

  const handleDuplicate = async (product: Product) => {
    try {
      const newSKU = await generateSKU();
      const now = new Date();

      const duplicatedProduct: Product = {
        name: `${product.name} (Copia)`,
        description: product.description,
        sku: newSKU,
        costUsd: product.costUsd,
        priceUsd: product.priceUsd,
        stockQuantity: 0,
        minStockAlert: product.minStockAlert,
        supplier: product.supplier,
        category: product.category,
        barcode: '',
        location: product.location,
        syncStatus: SyncStatus.PENDING,
        createdAt: now,
        updatedAt: now,
      };

      await db.products.add(duplicatedProduct);

      success(
        'Producto Duplicado',
        `"${duplicatedProduct.name}" ha sido creado exitosamente`,
        4000,
      );

      setOpenDropdown(null);
    } catch (err) {
      console.error('Error duplicating product:', err);
      showError('Error', 'No se pudo duplicar el producto', 3000);
    }
  };

  const handleDelete = async (product: Product) => {
    const confirmed = window.confirm(
      `¿Estás seguro de que deseas eliminar "${product.name}"?\n\nEsta acción no se puede deshacer.`,
    );

    if (!confirmed) {
      setOpenDropdown(null);
      return;
    }

    try {
      await db.products.delete(product.id!);

      success(
        'Producto Eliminado',
        `"${product.name}" ha sido eliminado del inventario`,
        4000,
      );

      setOpenDropdown(null);
    } catch (err) {
      console.error('Error deleting product:', err);
      showError('Error', 'No se pudo eliminar el producto', 3000);
    }
  };

  const handleAdjustStock = (product: Product) => {
    setSelectedProduct(product);
    setIsStockModalOpen(true);
    setOpenDropdown(null);
  };

  const handleProductSubmit = async (productData: Product) => {
    try {
      if (productModalMode === 'create') {
        await db.transaction('rw', db.products, db.inventoryMovements, async () => {
          const existing = await db.products.where('sku').equals(productData.sku).first();
          if (existing) {
            throw new Error(`El SKU "${productData.sku}" ya existe.`);
          }

          const productToAdd = { ...productData, createdAt: new Date(), updatedAt: new Date() };
          const id = await db.products.add(productToAdd);

          await db.inventoryMovements.add({
            productId: id as number,
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
        });

        success(
          'Producto Creado',
          `"${productData.name}" ha sido agregado al inventario exitosamente`,
          4000,
        );
      } else if (productModalMode === 'edit' && selectedProduct) {
        if (productData.sku !== selectedProduct.sku) {
          const existing = await db.products.where('sku').equals(productData.sku).first();
          if (existing) {
            showError('Error', `El SKU "${productData.sku}" ya existe.`, 5000);
            return;
          }
        }

        await db.products.update(selectedProduct.id!, productData);

        success(
          'Producto Actualizado',
          `"${productData.name}" ha sido actualizado exitosamente`,
          4000,
        );
      }

      setIsProductModalOpen(false);
      setSelectedProduct(null);
    } catch (err: any) {
      console.error('Error saving product:', err);
      showError('Error', err.message || 'No se pudo guardar el producto', 3000);
    }
  };

  const toggleDropdown = (sku: string) => {
    setOpenDropdown(openDropdown === sku ? null : sku);
  };

  const lowStockCount =
    allProducts?.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= (p.minStockAlert || 5))
      .length ?? 0;
  const outOfStockCount = allProducts?.filter((p) => p.stockQuantity === 0).length ?? 0;

  return (
    <div
      className="pm-scope pm-dark-area min-h-screen"
      style={{
        background: T.bg,
        color: T.charcoal,
        fontFamily: PM_FONT,
      }}
    >
      <div className="max-w-[1440px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-5">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-4 mb-5">
            <div>
              <div
                className="text-[11px] font-bold uppercase tracking-[0.05em] mb-1"
                style={{ color: T.slate500 }}
              >
                Operaciones / Catálogo
              </div>
              <h1
                className="text-[24px] font-bold leading-8 tracking-[-0.02em]"
                style={{ color: T.headline }}
              >
                Módulo de Inventario
              </h1>
              <p className="text-[13px] mt-1" style={{ color: T.slate500 }}>
                Gestiona tus productos, stock y movimientos de inventario.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 items-center">
              <Link
                href="/inventario/movimientos"
                className="inline-flex items-center gap-2 px-3 h-9 text-[13px] font-semibold rounded transition-colors"
                style={{
                  color: T.charcoal,
                  border: `1px solid ${T.slate300}`,
                  background: T.surface,
                }}
              >
                <History className="h-4 w-4" />
                Historial
              </Link>

              <button
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center gap-2 px-3 h-9 text-[13px] font-semibold rounded transition-colors"
                style={{
                  color: T.charcoal,
                  border: `1px solid ${T.slate300}`,
                  background: T.surface,
                }}
              >
                <Upload className="h-4 w-4" />
                Importar CSV
              </button>

              <button
                onClick={() => {
                  setProductModalMode('create');
                  setSelectedProduct(null);
                  setIsProductModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 h-9 text-[13px] font-bold rounded transition-colors"
                style={{
                  color: '#fff',
                  background: T.orange,
                  boxShadow: `0 1px 2px ${T.shadowSoft}`,
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background = T.orangeDark)
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background = T.orange)
                }
              >
                <Plus className="h-4 w-4" />
                Nuevo Producto
              </button>
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <KPI
              label="Productos"
              value={allProducts ? allProducts.length.toString() : '—'}
              hint="Total en catálogo"
            />
            <KPI
              label="Coincidencias"
              value={filteredProducts !== null ? filteredProducts.length.toString() : '—'}
              hint={filteredProducts !== null ? 'En filtro actual' : 'Sin filtro activo'}
              muted={filteredProducts === null}
            />
            <KPI
              label="Stock bajo"
              value={allProducts ? lowStockCount.toString() : '—'}
              hint="Por debajo del mínimo"
              tone={lowStockCount > 0 ? 'warn' : undefined}
            />
            <KPI
              label="Agotados"
              value={allProducts ? outOfStockCount.toString() : '—'}
              hint="Stock = 0"
              tone={outOfStockCount > 0 ? 'danger' : undefined}
            />
          </div>

          {/* Search */}
          <div
            className="bg-white rounded p-3"
            style={{ border: `1px solid ${T.slate200}` }}
          >
            <label
              className="block text-[11px] font-bold uppercase tracking-[0.05em] mb-1.5"
              style={{ color: T.slate500 }}
            >
              Buscar
            </label>
            <ProductSearch
              onFilter={setFilteredProducts}
              placeholder="Buscar productos por nombre, SKU o descripción…"
              showResults={false}
              className="max-w-3xl"
            />
          </div>
        </div>

        {/* Products Table */}
        <div
          className="bg-white rounded overflow-hidden"
          style={{
            border: `1px solid ${T.slate200}`,
            boxShadow: `0 1px 2px ${T.shadowSoft}`,
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ borderBottom: `1px solid ${T.slate200}`, background: T.slate50 }}
          >
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4" style={{ color: T.slate500 }} />
              <span
                className="text-[11px] font-bold uppercase tracking-[0.05em]"
                style={{ color: T.slate700 }}
              >
                Catálogo de productos
              </span>
            </div>
            <span className="text-[12px] pm-tnum" style={{ color: T.slate500 }}>
              {products ? `${products.length} filas` : 'Cargando…'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-[13px]">
              <thead className="sticky top-0 z-10">
                <tr style={{ background: T.slate100 }}>
                  <Th>SKU</Th>
                  <Th>Producto</Th>
                  <Th align="right">Stock</Th>
                  <Th align="right">Costo (USD)</Th>
                  <Th align="right">Precio (USD)</Th>
                  <Th>Proveedor</Th>
                  <Th>Estado</Th>
                  <Th align="right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {products && products.length > 0 ? (
                  products.map((item) => {
                    const isLow =
                      item.stockQuantity > 0 && item.stockQuantity <= (item.minStockAlert || 5);
                    const isOut = item.stockQuantity === 0;
                    return (
                      <tr
                        key={item.sku}
                        className="transition-colors"
                        style={{ borderTop: `1px solid ${T.slate200}` }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = T.shadowRow)
                        }
                        onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                      >
                        <Td>
                          <span
                            className="font-mono text-[12px] px-1.5 py-0.5 rounded"
                            style={{
                              background: T.slate100,
                              color: T.charcoal,
                            }}
                          >
                            {item.sku}
                          </span>
                        </Td>
                        <Td>
                          <div
                            className="font-semibold leading-tight"
                            style={{ color: T.charcoal }}
                          >
                            {item.name}
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {item.category && (
                              <span
                                className="text-[11px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                style={{
                                  background: T.slate100,
                                  color: T.slate500,
                                }}
                              >
                                {item.category}
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <div
                              className="text-[12px] mt-1 max-w-xs truncate"
                              style={{ color: T.slate500 }}
                            >
                              {item.description}
                            </div>
                          )}
                        </Td>
                        <Td align="right">
                          <div className="flex items-center justify-end gap-2">
                            <span
                              className="pm-tnum font-bold"
                              style={{
                                color: isOut
                                  ? T.red
                                  : isLow
                                  ? T.amber
                                  : T.charcoal,
                              }}
                            >
                              {item.stockQuantity}
                            </span>
                            {isOut && (
                              <span
                                className="text-[11px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                style={{ background: T.redSoft, color: T.red }}
                              >
                                Agotado
                              </span>
                            )}
                            {isLow && !isOut && (
                              <span
                                className="text-[11px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                style={{ background: T.amberSoft, color: T.amber }}
                              >
                                Bajo
                              </span>
                            )}
                          </div>
                        </Td>
                        <Td align="right">
                          <span className="pm-tnum" style={{ color: T.slate700 }}>
                            {item.costUsd != null ? `$${item.costUsd.toFixed(2)}` : '—'}
                          </span>
                        </Td>
                        <Td align="right">
                          <span
                            className="pm-tnum font-bold"
                            style={{ color: T.charcoal }}
                          >
                            ${item.priceUsd.toFixed(2)}
                          </span>
                        </Td>
                        <Td>
                          <span style={{ color: T.slate700 }}>{item.supplier || '—'}</span>
                        </Td>
                        <Td>{getSyncStatusBadge(item.syncStatus)}</Td>
                        <Td align="right">
                          <div className="relative inline-block">
                            <button
                              onClick={() => toggleDropdown(item.sku)}
                              className="inline-flex items-center justify-center h-8 w-8 rounded transition-colors"
                              style={{ color: T.slate500 }}
                              onMouseEnter={(e) =>
                                ((e.currentTarget as HTMLButtonElement).style.background =
                                  T.slate100)
                              }
                              onMouseLeave={(e) =>
                                ((e.currentTarget as HTMLButtonElement).style.background = '')
                              }
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>

                            {openDropdown === item.sku && (
                              <div
                                className="absolute right-0 mt-1 w-52 rounded z-50 overflow-hidden"
                                style={{
                                  background: T.surface,
                                  border: `1px solid ${T.slate200}`,
                                  boxShadow: `0 8px 24px ${T.shadowStrong}`,
                                }}
                              >
                                <DropdownItem
                                  icon={<Edit className="h-4 w-4" />}
                                  onClick={() => handleEdit(item)}
                                >
                                  Editar
                                </DropdownItem>
                                <DropdownItem
                                  icon={<MinusCircle className="h-4 w-4" />}
                                  onClick={() => handleAdjustStock(item)}
                                >
                                  Ajustar Stock
                                </DropdownItem>
                                <DropdownItem
                                  icon={<Copy className="h-4 w-4" />}
                                  onClick={() => handleDuplicate(item)}
                                >
                                  Duplicar
                                </DropdownItem>
                                <div
                                  style={{ borderTop: `1px solid ${T.slate200}` }}
                                />
                                <DropdownItem
                                  icon={<Trash2 className="h-4 w-4" />}
                                  onClick={() => handleDelete(item)}
                                  danger
                                >
                                  Eliminar
                                </DropdownItem>
                              </div>
                            )}
                          </div>
                        </Td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center py-12">
                      <Package
                        className="h-10 w-10 mx-auto mb-3"
                        style={{ color: T.slate300 }}
                      />
                      <p className="text-[13px]" style={{ color: T.slate500 }}>
                        {products === undefined
                          ? 'Cargando productos…'
                          : 'No hay productos en el inventario.'}
                      </p>
                      {products !== undefined && products.length === 0 && (
                        <button
                          onClick={() => {
                            setProductModalMode('create');
                            setSelectedProduct(null);
                            setIsProductModalOpen(true);
                          }}
                          className="mt-4 inline-flex items-center gap-2 px-4 h-9 text-[13px] font-bold rounded"
                          style={{ background: T.orange, color: '#fff' }}
                        >
                          <Plus className="h-4 w-4" />
                          Agregar primer producto
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
              {products && products.length > 0 && (
                <tfoot>
                  <tr style={{ background: T.slate50 }}>
                    <td
                      colSpan={4}
                      className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.05em]"
                      style={{ color: T.slate500, borderTop: `1px solid ${T.slate200}` }}
                    >
                      Total ({products.length})
                    </td>
                    <td
                      className="px-3 py-2 text-right pm-tnum font-bold"
                      style={{ color: T.charcoal, borderTop: `1px solid ${T.slate200}` }}
                    >
                      $
                      {products
                        .reduce((sum, p) => sum + (p.priceUsd || 0) * (p.stockQuantity || 0), 0)
                        .toFixed(2)}
                    </td>
                    <td
                      colSpan={3}
                      className="px-3 py-2 text-[11px]"
                      style={{ color: T.slate500, borderTop: `1px solid ${T.slate200}` }}
                    >
                      Valor de inventario
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
        mode={productModalMode}
        onSubmit={handleProductSubmit}
      />

      <StockAdjustmentModal
        isOpen={isStockModalOpen}
        onClose={() => {
          setIsStockModalOpen(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
      />

      <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
    </div>
  );
}

function KPI({
  label,
  value,
  hint,
  tone,
  muted,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'warn' | 'danger';
  muted?: boolean;
}) {
  const accent =
    tone === 'danger' ? T.red : tone === 'warn' ? T.amber : T.charcoal;
  return (
    <div
      className="bg-white rounded px-4 py-3"
      style={{ border: `1px solid ${T.slate200}` }}
    >
      <div
        className="text-[11px] font-bold uppercase tracking-[0.05em]"
        style={{ color: T.slate500 }}
      >
        {label}
      </div>
      <div
        className="pm-tnum text-[24px] font-bold leading-8 tracking-[-0.02em] mt-1"
        style={{ color: muted ? T.slate400 : accent }}
      >
        {value}
      </div>
      {hint && (
        <div className="text-[12px] mt-0.5" style={{ color: T.slate500 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.05em] select-none"
      style={{
        color: T.slate700,
        borderBottom: `1px solid ${T.slate200}`,
        textAlign: align,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <td
      className="px-3 py-2 align-middle"
      style={{ textAlign: align, color: T.charcoal }}
    >
      {children}
    </td>
  );
}

function DropdownItem({
  icon,
  onClick,
  danger,
  children,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full px-3 py-2 text-[13px] transition-colors"
      style={{ color: danger ? T.red : T.charcoal, background: 'transparent' }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.background = danger
          ? T.redSoft
          : T.slate100)
      }
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
    >
      {icon}
      {children}
    </button>
  );
}
