"use client";

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, InventoryMovement, MovementType } from '@/app/_db/db';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Minus,
  Calendar,
  Package,
  Filter,
  Search,
  History,
} from 'lucide-react';
import Link from 'next/link';
import { TOKENS } from '@/app/_components/_pmTheme';

const MOVEMENT_META: Record<
  MovementType,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  [MovementType.SALE]: {
    label: 'Venta',
    color: TOKENS.red,
    bg: TOKENS.redSoft,
    icon: <ArrowDown className="h-3 w-3" />,
  },
  [MovementType.PURCHASE]: {
    label: 'Compra',
    color: TOKENS.green,
    bg: TOKENS.greenSoft,
    icon: <ArrowUp className="h-3 w-3" />,
  },
  [MovementType.ADJUSTMENT]: {
    label: 'Ajuste',
    color: TOKENS.charcoal,
    bg: TOKENS.slate100,
    icon: <Minus className="h-3 w-3" />,
  },
  [MovementType.INITIAL]: {
    label: 'Stock Inicial',
    color: TOKENS.slate700,
    bg: TOKENS.slate100,
    icon: <Package className="h-3 w-3" />,
  },
  [MovementType.RETURN]: {
    label: 'Devolución',
    color: TOKENS.orange,
    bg: TOKENS.orangeSoft,
    icon: <ArrowUp className="h-3 w-3" />,
  },
};

export default function MovementsPage() {
  const [filteredMovements, setFilteredMovements] = useState<InventoryMovement[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<number | 'all'>('all');
  const [selectedType, setSelectedType] = useState<MovementType | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const movements = useLiveQuery(
    () => db.inventoryMovements.orderBy('createdAt').reverse().toArray(),
    [],
  );

  const products = useLiveQuery(() => db.products.toArray(), []);

  useEffect(() => {
    if (!movements) return;

    let filtered = movements;

    if (selectedProduct !== 'all') {
      filtered = filtered.filter((m) => m.productId === selectedProduct);
    }
    if (selectedType !== 'all') {
      filtered = filtered.filter((m) => m.type === selectedType);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.productName.toLowerCase().includes(term) ||
          m.productSku.toLowerCase().includes(term) ||
          m.notes?.toLowerCase().includes(term),
      );
    }

    setFilteredMovements(filtered);
  }, [movements, selectedProduct, selectedType, searchTerm]);

  const formatDate = (date: Date) =>
    new Date(date).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/inventario"
              className="inline-flex items-center justify-center h-9 w-9 rounded transition-colors"
              style={{
                background: '#fff',
                border: `1px solid ${TOKENS.slate200}`,
                color: TOKENS.slate500,
              }}
              aria-label="Volver al inventario"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="pm-eyebrow mb-1">Operaciones / Inventario</div>
              <div className="flex items-center gap-2.5">
                <div
                  className="flex items-center justify-center h-9 w-9 rounded"
                  style={{ background: TOKENS.charcoal, color: '#fff' }}
                >
                  <History className="h-4 w-4" />
                </div>
                <div>
                  <h1
                    className="text-[24px] font-bold leading-8 tracking-[-0.02em]"
                    style={{ color: TOKENS.charcoal }}
                  >
                    Historial de Movimientos
                  </h1>
                  <p className="text-[13px]" style={{ color: TOKENS.slate500 }}>
                    Registro de todos los cambios en el inventario
                  </p>
                </div>
              </div>
            </div>
          </div>
          <span className="pm-eyebrow pm-tnum">
            {movements ? `${movements.length} movimientos` : 'Cargando…'}
          </span>
        </div>

        {/* Filters */}
        <section className="pm-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4" style={{ color: TOKENS.slate500 }} />
            <span className="pm-eyebrow" style={{ color: TOKENS.slate700 }}>
              Filtros
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="pm-label">
                <Search className="h-3 w-3 inline mr-1" />
                Buscar
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Producto, SKU o notas…"
                className="pm-input"
              />
            </div>

            <div>
              <label className="pm-label">
                <Package className="h-3 w-3 inline mr-1" />
                Producto
              </label>
              <select
                value={selectedProduct}
                onChange={(e) =>
                  setSelectedProduct(e.target.value === 'all' ? 'all' : parseInt(e.target.value))
                }
                className="pm-input"
              >
                <option value="all">Todos los productos</option>
                {products?.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="pm-label">Tipo de Movimiento</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as MovementType | 'all')}
                className="pm-input"
              >
                <option value="all">Todos los tipos</option>
                {Object.entries(MOVEMENT_META).map(([type, config]) => (
                  <option key={type} value={type}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Table */}
        <section className="pm-card overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{
              borderBottom: `1px solid ${TOKENS.slate200}`,
              background: TOKENS.slate50,
            }}
          >
            <div className="flex items-center gap-2">
              <History className="h-4 w-4" style={{ color: TOKENS.slate500 }} />
              <span className="pm-eyebrow" style={{ color: TOKENS.slate700 }}>
                Movimientos
              </span>
            </div>
            <span className="text-[12px] pm-tnum" style={{ color: TOKENS.slate500 }}>
              {filteredMovements.length} filas
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-[13px]">
              <thead className="sticky top-0 z-10">
                <tr style={{ background: TOKENS.slate100 }}>
                  <Th>Fecha</Th>
                  <Th>Producto</Th>
                  <Th>Tipo</Th>
                  <Th align="right">Cantidad</Th>
                  <Th align="right">Stock Anterior</Th>
                  <Th align="right">Stock Nuevo</Th>
                  <Th>Notas</Th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.length > 0 ? (
                  filteredMovements.map((movement) => {
                    const meta = MOVEMENT_META[movement.type];
                    const qtyColor =
                      movement.quantity > 0
                        ? TOKENS.green
                        : movement.quantity < 0
                        ? TOKENS.red
                        : TOKENS.slate500;
                    return (
                      <tr
                        key={movement.id}
                        style={{ borderTop: `1px solid ${TOKENS.slate200}` }}
                      >
                        <Td>
                          <div className="flex items-center gap-2">
                            <Calendar
                              className="h-3.5 w-3.5"
                              style={{ color: TOKENS.slate400 }}
                            />
                            <span className="pm-tnum" style={{ color: TOKENS.charcoal }}>
                              {formatDate(movement.createdAt)}
                            </span>
                          </div>
                        </Td>
                        <Td>
                          <div
                            className="font-semibold"
                            style={{ color: TOKENS.charcoal }}
                          >
                            {movement.productName}
                          </div>
                          <div
                            className="font-mono text-[11px] mt-0.5"
                            style={{ color: TOKENS.slate500 }}
                          >
                            {movement.productSku}
                          </div>
                        </Td>
                        <Td>
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider"
                            style={{ background: meta.bg, color: meta.color }}
                          >
                            {meta.icon}
                            {meta.label}
                          </span>
                        </Td>
                        <Td align="right">
                          <span
                            className="pm-tnum font-bold"
                            style={{ color: qtyColor }}
                          >
                            {movement.quantity > 0 ? '+' : ''}
                            {movement.quantity}
                          </span>
                        </Td>
                        <Td align="right">
                          <span className="pm-tnum" style={{ color: TOKENS.slate500 }}>
                            {movement.previousStock}
                          </span>
                        </Td>
                        <Td align="right">
                          <span
                            className="pm-tnum font-bold"
                            style={{ color: TOKENS.charcoal }}
                          >
                            {movement.newStock}
                          </span>
                        </Td>
                        <Td>
                          <span
                            className="text-[12px] max-w-xs truncate inline-block"
                            style={{ color: TOKENS.slate500 }}
                          >
                            {movement.notes || '—'}
                          </span>
                        </Td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-12 text-center"
                      style={{ color: TOKENS.slate500 }}
                    >
                      <Package
                        className="h-10 w-10 mx-auto mb-3"
                        style={{ color: TOKENS.slate300 }}
                      />
                      <p className="text-[14px] font-semibold mb-1">
                        No hay movimientos registrados
                      </p>
                      <p className="text-[12px]">
                        Los movimientos aparecerán cuando realices ventas, compras o
                        ajustes de stock
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
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
        color: TOKENS.slate700,
        borderBottom: `1px solid ${TOKENS.slate200}`,
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
      className="px-3 py-2.5 align-middle"
      style={{ textAlign: align, color: TOKENS.charcoal }}
    >
      {children}
    </td>
  );
}
