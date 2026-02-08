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
  MinusCircle
} from 'lucide-react';

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
    switch (status) {
      case SyncStatus.SYNCED:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Sincronizado</span>;
      case SyncStatus.PENDING:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">Pendiente</span>;
      case SyncStatus.SYNCING:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Sincronizando</span>;
      case SyncStatus.ERROR:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Error</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">-</span>;
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
        barcode: '', // Don't duplicate barcode
        location: product.location,
        syncStatus: SyncStatus.PENDING,
        createdAt: now,
        updatedAt: now,
      };

      const id = await db.products.add(duplicatedProduct);
      
      success(
        'Producto Duplicado',
        `"${duplicatedProduct.name}" ha sido creado exitosamente`,
        4000
      );
      
      setOpenDropdown(null);
    } catch (err) {
      console.error('Error duplicating product:', err);
      showError('Error', 'No se pudo duplicar el producto', 3000);
    }
  };

  const handleDelete = async (product: Product) => {
    const confirmed = window.confirm(
      `¿Estás seguro de que deseas eliminar "${product.name}"?\n\nEsta acción no se puede deshacer.`
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
        4000
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
      if (productModalMode === 'edit' && selectedProduct) {
        // Check if SKU changed and if new SKU exists
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
          4000
        );
      }
      
      setIsProductModalOpen(false);
      setSelectedProduct(null);
    } catch (err) {
      console.error('Error saving product:', err);
      showError('Error', 'No se pudo guardar el producto', 3000);
    }
  };

  const toggleDropdown = (sku: string) => {
    setOpenDropdown(openDropdown === sku ? null : sku);
  };

  return (
    <div className="container mx-auto p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold">Módulo de Inventario</h1>
            <p className="text-gray-600 mt-1">
              Gestiona tus productos, stock y movimientos de inventario
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Link
              href="/inventario/movimientos"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <History className="h-4 w-4 mr-2" />
              Historial
            </Link>
            
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar CSV
            </button>
            
            <button
              onClick={() => {
                setProductModalMode('create');
                setSelectedProduct(null);
                setIsProductModalOpen(true);
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Producto
            </button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
          <span className="bg-gray-100 px-3 py-1 rounded-full">
            {allProducts ? `${allProducts.length} productos` : 'Cargando...'}
          </span>
          {filteredProducts !== null && (
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'coincidencia' : 'coincidencias'}
            </span>
          )}
          {allProducts && (
            <>
              <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full">
                {allProducts.filter(p => p.stockQuantity <= (p.minStockAlert || 5)).length} stock bajo
              </span>
              <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full">
                {allProducts.filter(p => p.stockQuantity === 0).length} agotados
              </span>
            </>
          )}
        </div>
        
        {/* Search Bar */}
        <ProductSearch
          onFilter={setFilteredProducts}
          placeholder="Buscar productos por nombre, SKU o descripción..."
          showResults={false}
          className="max-w-2xl"
        />
      </div>

      {/* Products Table */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full leading-normal">
            <thead>
              <tr>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Producto
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Costo (USD)
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Precio (USD)
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Proveedor
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {products && products.length > 0 ? (
                products.map((item) => (
                  <tr key={item.sku} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 border-b border-gray-200 bg-white text-sm">
                      <p className="text-gray-900 whitespace-no-wrap font-mono text-xs">{item.sku}</p>
                    </td>
                    <td className="px-5 py-4 border-b border-gray-200 bg-white text-sm">
                      <p className="text-gray-900 whitespace-no-wrap font-medium">{item.name}</p>
                      {item.category && (
                        <span className="inline-block mt-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {item.category}
                        </span>
                      )}
                      {item.description && (
                        <p className="text-gray-500 text-xs mt-1 max-w-xs truncate">{item.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 border-b border-gray-200 bg-white text-sm">
                      <div className="flex items-center">
                        <p className={`whitespace-no-wrap font-semibold ${
                          item.stockQuantity <= (item.minStockAlert || 5) 
                            ? item.stockQuantity === 0 
                              ? 'text-red-600' 
                              : 'text-yellow-600'
                            : 'text-gray-900'
                        }`}>
                          {item.stockQuantity}
                        </p>
                        {item.stockQuantity === 0 && (
                          <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
                            Agotado
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 border-b border-gray-200 bg-white text-sm">
                      <p className="text-gray-900 whitespace-no-wrap">${item.costUsd?.toFixed(2) || '-'}</p>
                    </td>
                    <td className="px-5 py-4 border-b border-gray-200 bg-white text-sm">
                      <p className="text-gray-900 whitespace-no-wrap font-semibold">${item.priceUsd.toFixed(2)}</p>
                    </td>
                    <td className="px-5 py-4 border-b border-gray-200 bg-white text-sm">
                      <p className="text-gray-900 whitespace-no-wrap">{item.supplier || '-'}</p>
                    </td>
                    <td className="px-5 py-4 border-b border-gray-200 bg-white text-sm">
                      {getSyncStatusBadge(item.syncStatus)}
                    </td>
                    <td className="px-5 py-4 border-b border-gray-200 bg-white text-sm">
                      <div className="relative">
                        <button
                          onClick={() => toggleDropdown(item.sku)}
                          className="text-gray-500 hover:text-gray-700 focus:outline-none"
                        >
                          <MoreVertical className="h-5 w-5" />
                        </button>
                        
                        {openDropdown === item.sku && (
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50 border">
                            <div className="py-1">
                              <button
                                onClick={() => handleEdit(item)}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </button>
                              
                              <button
                                onClick={() => handleAdjustStock(item)}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <MinusCircle className="h-4 w-4 mr-2" />
                                Ajustar Stock
                              </button>
                              
                              <button
                                onClick={() => handleDuplicate(item)}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicar
                              </button>
                              
                              <hr className="my-1" />
                              
                              <button
                                onClick={() => handleDelete(item)}
                                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-10">
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500">
                      {products === undefined ? 'Cargando productos...' : 'No hay productos en el inventario.'}
                    </p>
                    {products !== undefined && products.length === 0 && (
                      <button
                        onClick={() => {
                          setProductModalMode('create');
                          setSelectedProduct(null);
                          setIsProductModalOpen(true);
                        }}
                        className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar primer producto
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  );
}
