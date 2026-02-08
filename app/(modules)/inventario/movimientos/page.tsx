"use client";

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, InventoryMovement, MovementType, Product } from '@/app/_db/db';
import { ArrowLeft, ArrowUp, ArrowDown, Minus, Calendar, Package, Filter, Search } from 'lucide-react';
import Link from 'next/link';

const MOVEMENT_TYPE_LABELS: Record<MovementType, { label: string; color: string; icon: React.ReactNode }> = {
  [MovementType.SALE]: { 
    label: 'Venta', 
    color: 'text-red-600 bg-red-100',
    icon: <ArrowDown className="h-4 w-4" />
  },
  [MovementType.PURCHASE]: { 
    label: 'Compra', 
    color: 'text-green-600 bg-green-100',
    icon: <ArrowUp className="h-4 w-4" />
  },
  [MovementType.ADJUSTMENT]: { 
    label: 'Ajuste', 
    color: 'text-blue-600 bg-blue-100',
    icon: <Minus className="h-4 w-4" />
  },
  [MovementType.INITIAL]: { 
    label: 'Stock Inicial', 
    color: 'text-gray-600 bg-gray-100',
    icon: <Package className="h-4 w-4" />
  },
  [MovementType.RETURN]: { 
    label: 'Devolución', 
    color: 'text-purple-600 bg-purple-100',
    icon: <ArrowUp className="h-4 w-4" />
  },
};

export default function MovementsPage() {
  const [filteredMovements, setFilteredMovements] = useState<InventoryMovement[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<number | 'all'>('all');
  const [selectedType, setSelectedType] = useState<MovementType | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const movements = useLiveQuery(
    () => db.inventoryMovements.orderBy('createdAt').reverse().toArray(),
    []
  );

  const products = useLiveQuery(
    () => db.products.toArray(),
    []
  );

  useEffect(() => {
    if (!movements) return;

    let filtered = movements;

    // Filter by product
    if (selectedProduct !== 'all') {
      filtered = filtered.filter(m => m.productId === selectedProduct);
    }

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter(m => m.type === selectedType);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(m =>
        m.productName.toLowerCase().includes(term) ||
        m.productSku.toLowerCase().includes(term) ||
        m.notes?.toLowerCase().includes(term)
      );
    }

    setFilteredMovements(filtered);
  }, [movements, selectedProduct, selectedType, searchTerm]);

  const getProductName = (productId: number) => {
    const product = products?.find(p => p.id === productId);
    return product?.name || 'Producto desconocido';
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="container mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Link
            href="/inventario"
            className="mr-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Historial de Movimientos</h1>
            <p className="text-sm text-gray-600 mt-1">
              Registro de todos los cambios en el inventario
            </p>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          {movements ? `${movements.length} movimientos` : 'Cargando...'}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6">
        <div className="flex items-center mb-4">
          <Filter className="h-5 w-5 text-gray-500 mr-2" />
          <h2 className="text-lg font-semibold">Filtros</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Search className="h-4 w-4 inline mr-1" />
              Buscar
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Producto, SKU o notas..."
              className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          {/* Product Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Package className="h-4 w-4 inline mr-1" />
              Producto
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="all">Todos los productos</option>
              {products?.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Movimiento
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as MovementType | 'all')}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="all">Todos los tipos</option>
              {Object.entries(MOVEMENT_TYPE_LABELS).map(([type, config]) => (
                <option key={type} value={type}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Producto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cantidad
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock Anterior
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock Nuevo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notas
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMovements.length > 0 ? (
                filteredMovements.map((movement) => {
                  const typeConfig = MOVEMENT_TYPE_LABELS[movement.type];
                  return (
                    <tr key={movement.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                          {formatDate(movement.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {movement.productName}
                        </div>
                        <div className="text-xs text-gray-500">
                          SKU: {movement.productSku}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeConfig.color}`}>
                          {typeConfig.icon}
                          <span className="ml-1">{typeConfig.label}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <span className={`font-medium ${
                          movement.quantity > 0 ? 'text-green-600' : 
                          movement.quantity < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                        {movement.previousStock}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                        {movement.newStock}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {movement.notes || '-'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">No hay movimientos registrados</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Los movimientos aparecerán cuando realices ventas, compras o ajustes de stock
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
