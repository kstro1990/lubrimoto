"use client";

import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/app/_db/db';
import { PlusCircle, ShoppingCart, Receipt } from 'lucide-react';
import { TOKENS, PMBtnPrimary } from '@/app/_components/_pmTheme';

export default function VentasPage() {
  const sales = useLiveQuery(() => db.sales.orderBy('date').reverse().toArray(), []);

  const totalRevenue = sales?.reduce((sum, s) => sum + s.totalAmountUsd, 0) ?? 0;

  return (
    <div className="min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-4 mb-5">
          <div>
            <div className="pm-eyebrow mb-1">Operaciones / Ventas</div>
            <div className="flex items-center gap-2.5">
              <div
                className="flex items-center justify-center h-9 w-9 rounded"
                style={{ background: TOKENS.charcoal, color: '#fff' }}
              >
                <Receipt className="h-4 w-4" />
              </div>
              <div>
                <h1
                  className="text-[24px] font-bold leading-8 tracking-[-0.02em]"
                  style={{ color: TOKENS.charcoal }}
                >
                  Historial de Ventas
                </h1>
                <p className="text-[13px]" style={{ color: TOKENS.slate500 }}>
                  Registro de transacciones de la tienda
                </p>
              </div>
            </div>
          </div>

          <Link href="/ventas/nueva">
            <PMBtnPrimary>
              <PlusCircle className="w-4 h-4" />
              Nueva Venta
            </PMBtnPrimary>
          </Link>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <div className="pm-card px-4 py-3">
            <div className="pm-eyebrow">Transacciones</div>
            <div
              className="pm-tnum text-[24px] font-bold leading-8 tracking-[-0.02em] mt-1"
              style={{ color: TOKENS.charcoal }}
            >
              {sales ? sales.length : '—'}
            </div>
            <div className="text-[12px] mt-0.5" style={{ color: TOKENS.slate500 }}>
              Total en historial
            </div>
          </div>
          <div className="pm-card px-4 py-3">
            <div className="pm-eyebrow">Ingresos Totales</div>
            <div
              className="pm-tnum text-[24px] font-bold leading-8 tracking-[-0.02em] mt-1"
              style={{ color: TOKENS.charcoal }}
            >
              ${totalRevenue.toFixed(2)}
            </div>
            <div className="text-[12px] mt-0.5" style={{ color: TOKENS.slate500 }}>
              USD acumulado
            </div>
          </div>
          <div className="pm-card px-4 py-3">
            <div className="pm-eyebrow">Ticket Promedio</div>
            <div
              className="pm-tnum text-[24px] font-bold leading-8 tracking-[-0.02em] mt-1"
              style={{ color: TOKENS.charcoal }}
            >
              ${sales && sales.length ? (totalRevenue / sales.length).toFixed(2) : '0.00'}
            </div>
            <div className="text-[12px] mt-0.5" style={{ color: TOKENS.slate500 }}>
              USD por venta
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="pm-card overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{
              borderBottom: `1px solid ${TOKENS.slate200}`,
              background: TOKENS.slate50,
            }}
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" style={{ color: TOKENS.slate500 }} />
              <span className="pm-eyebrow" style={{ color: TOKENS.slate700 }}>
                Todas las ventas
              </span>
            </div>
            {sales && (
              <span className="text-[12px] pm-tnum" style={{ color: TOKENS.slate500 }}>
                {sales.length} filas
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-[13px]">
              <thead className="sticky top-0 z-10">
                <tr style={{ background: TOKENS.slate100 }}>
                  <Th>ID</Th>
                  <Th>Fecha</Th>
                  <Th>Cliente</Th>
                  <Th align="right">Total USD</Th>
                </tr>
              </thead>
              <tbody>
                {sales && sales.length > 0 ? (
                  sales.map((sale) => (
                    <tr
                      key={sale.id}
                      style={{ borderTop: `1px solid ${TOKENS.slate200}` }}
                    >
                      <Td>
                        <span
                          className="font-mono text-[12px] px-1.5 py-0.5 rounded"
                          style={{
                            background: TOKENS.slate100,
                            color: TOKENS.charcoal,
                          }}
                        >
                          #{sale.id}
                        </span>
                      </Td>
                      <Td>
                        <span className="pm-tnum" style={{ color: TOKENS.charcoal }}>
                          {new Date(sale.date).toLocaleString('es-VE', {
                            day: '2-digit',
                            month: 'short',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </Td>
                      <Td>
                        <span style={{ color: TOKENS.slate700 }}>
                          {sale.customerId ? `#${sale.customerId}` : '—'}
                        </span>
                      </Td>
                      <Td align="right">
                        <span
                          className="pm-tnum font-bold"
                          style={{ color: TOKENS.charcoal }}
                        >
                          ${sale.totalAmountUsd.toFixed(2)}
                        </span>
                      </Td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-12 text-center text-[13px]"
                      style={{ color: TOKENS.slate500 }}
                    >
                      <Receipt
                        className="h-10 w-10 mx-auto mb-3"
                        style={{ color: TOKENS.slate300 }}
                      />
                      <p>No hay ventas registradas.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
