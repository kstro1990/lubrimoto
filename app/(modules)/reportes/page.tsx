"use client";

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Product } from '@/app/_db/db';
import {
  TrendingUp,
  DollarSign,
  Package,
  ShoppingCart,
  Calendar,
  AlertTriangle,
  BarChart3,
  PieChart as PieIcon,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { PMScope, TOKENS, PM_FONT } from '@/app/_components/_pmTheme';

interface SalesStats {
  totalSales: number;
  totalRevenue: number;
  totalTransactions: number;
  averageTicket: number;
}

interface TopProduct {
  sku: string;
  name: string;
  quantitySold: number;
  revenue: number;
}

// Precision Moto chart palette: charcoal-led ramp with Racing Orange accent.
const CHART_COLORS = ['#121826', '#FF5F00', '#475569', '#B45309', '#0F766E'];

export default function ReportesPage() {
  const [dateRange, setDateRange] = useState<'7' | '30' | '90' | 'all'>('30');
  const [stats, setStats] = useState<SalesStats>({
    totalSales: 0,
    totalRevenue: 0,
    totalTransactions: 0,
    averageTicket: 0,
  });
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [salesByDay, setSalesByDay] = useState<
    { date: string; amount: number; isToday?: boolean }[]
  >([]);
  const [todaySales, setTodaySales] = useState<{ amount: number; transactions: number }>({
    amount: 0,
    transactions: 0,
  });

  const sales = useLiveQuery(() => db.sales.toArray(), []);
  const products = useLiveQuery(() => db.products.toArray(), []);
  const saleItems = useLiveQuery(() => db.saleItems.toArray(), []);

  useEffect(() => {
    if (!sales || !products || !saleItems) return;

    const now = new Date();
    const daysAgo = dateRange === 'all' ? 3650 : parseInt(dateRange);

    const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const filteredSales = sales.filter((sale) => {
      const saleDateStr = new Date(sale.date).toISOString().split('T')[0];
      return saleDateStr >= startDateStr && saleDateStr <= endDateStr;
    });

    const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.totalAmountUsd, 0);
    const totalTransactions = filteredSales.length;
    const averageTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    setStats({
      totalSales: totalRevenue,
      totalRevenue,
      totalTransactions,
      averageTicket,
    });

    const todayStr = now.toISOString().split('T')[0];
    const todaySalesData = sales.filter((sale) => {
      const saleDateStr = new Date(sale.date).toISOString().split('T')[0];
      return saleDateStr === todayStr;
    });
    const todayTotal = todaySalesData.reduce((sum, sale) => sum + sale.totalAmountUsd, 0);
    setTodaySales({
      amount: todayTotal,
      transactions: todaySalesData.length,
    });

    const productSales: {
      [key: string]: { name: string; quantity: number; revenue: number };
    } = {};

    filteredSales.forEach((sale) => {
      const items = saleItems.filter((item) => item.saleId === sale.id);
      items.forEach((item) => {
        const product = products.find((p) => p.sku === item.productId);
        if (product) {
          if (!productSales[product.sku]) {
            productSales[product.sku] = { name: product.name, quantity: 0, revenue: 0 };
          }
          productSales[product.sku].quantity += item.quantity;
          productSales[product.sku].revenue += item.quantity * item.pricePerUnitUsd;
        }
      });
    });

    const sortedProducts: TopProduct[] = Object.entries(productSales)
      .map(([sku, data]) => ({
        sku,
        name: data.name,
        quantitySold: data.quantity,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    setTopProducts(sortedProducts);

    const lowStock = products.filter((p) => p.stockQuantity <= (p.minStockAlert || 5));
    setLowStockProducts(lowStock);

    const daysToShow =
      dateRange === 'all'
        ? Math.min(
            90,
            Math.ceil(
              (now.getTime() -
                Math.min(...sales.map((s) => new Date(s.date).getTime()))) /
                (1000 * 60 * 60 * 24),
            ),
          )
        : parseInt(dateRange);

    const salesByDayData: { date: string; amount: number; isToday?: boolean }[] = [];

    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];

      const daySales = sales.filter((sale) => {
        const saleDateStr = new Date(sale.date).toISOString().split('T')[0];
        return saleDateStr === dateStr;
      });

      const dayTotal = daySales.reduce((sum, sale) => sum + sale.totalAmountUsd, 0);
      const isToday = i === 0;
      salesByDayData.push({ date: dateStr, amount: dayTotal, isToday });
    }
    setSalesByDay(salesByDayData);
  }, [sales, products, saleItems, dateRange]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (dateRange === '30' || dateRange === '90' || dateRange === 'all') {
      return date.toLocaleDateString('es-VE', { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric' });
  };

  const formatShortCurrency = (value: number) => {
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
    return `$${value}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div
          className="text-[12px] px-3 py-2 rounded"
          style={{
            background: TOKENS.charcoal,
            color: '#fff',
            boxShadow: '0 8px 20px rgba(18, 24, 38, 0.18)',
          }}
        >
          <div
            className="font-bold uppercase tracking-wider text-[11px] mb-1"
            style={{ color: TOKENS.slate300 }}
          >
            {data.isToday
              ? 'Hoy'
              : new Date(label).toLocaleDateString('es-VE', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
          </div>
          <div className="pm-tnum font-bold text-[14px]">{formatCurrency(data.amount)}</div>
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div
          className="text-[12px] px-3 py-2 rounded"
          style={{
            background: TOKENS.charcoal,
            color: '#fff',
            boxShadow: '0 8px 20px rgba(18, 24, 38, 0.18)',
          }}
        >
          <div
            className="font-bold uppercase tracking-wider text-[11px] mb-1"
            style={{ color: TOKENS.slate300 }}
          >
            {data.name}
          </div>
          <div className="pm-tnum font-bold text-[14px]">{formatCurrency(data.value)}</div>
          <div className="pm-tnum text-[11px]" style={{ color: TOKENS.slate400 }}>
            {data.payload.quantitySold} unidades
          </div>
        </div>
      );
    }
    return null;
  };

  const rangeLabel = {
    '7': 'Últimos 7 días',
    '30': 'Últimos 30 días',
    '90': 'Últimos 90 días',
    all: 'Todo el tiempo',
  }[dateRange];

  return (
    <PMScope
      className="min-h-screen"
      style={{ background: TOKENS.bg, fontFamily: PM_FONT }}
    >
      <div className="max-w-[1440px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-5">
          <div>
            <div
              className="text-[11px] font-bold uppercase tracking-[0.05em] mb-1"
              style={{ color: TOKENS.slate500 }}
            >
              Análisis / Desempeño Comercial
            </div>
            <div className="flex items-center gap-2.5">
              <div
                className="flex items-center justify-center h-9 w-9 rounded"
                style={{ background: TOKENS.charcoal, color: '#fff' }}
              >
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <h1
                  className="text-[24px] font-bold leading-8 tracking-[-0.02em]"
                  style={{ color: TOKENS.charcoal }}
                >
                  Dashboard de Reportes
                </h1>
                <p className="text-[13px]" style={{ color: TOKENS.slate500 }}>
                  Métricas de ingresos, productos top y alertas de stock · {rangeLabel}
                </p>
              </div>
            </div>
          </div>

          {/* Date range selector */}
          <div
            className="inline-flex items-center gap-2 px-3 h-9 rounded"
            style={{
              background: '#fff',
              border: `1px solid ${TOKENS.slate300}`,
            }}
          >
            <Calendar className="h-4 w-4" style={{ color: TOKENS.slate500 }} />
            <span
              className="text-[11px] font-bold uppercase tracking-[0.05em]"
              style={{ color: TOKENS.slate500 }}
            >
              Rango
            </span>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="text-[13px] font-semibold bg-transparent outline-none"
              style={{ color: TOKENS.charcoal }}
            >
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
              <option value="all">Todo el tiempo</option>
            </select>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <KPICard
            label="Ingresos Totales"
            value={formatCurrency(stats.totalRevenue)}
            icon={<DollarSign className="h-4 w-4" />}
            iconBg={TOKENS.charcoal}
            iconColor="#fff"
          />
          <KPICard
            label="Transacciones"
            value={stats.totalTransactions.toString()}
            icon={<ShoppingCart className="h-4 w-4" />}
            iconBg={TOKENS.slate100}
            iconColor={TOKENS.charcoal}
          />
          <KPICard
            label="Ticket Promedio"
            value={formatCurrency(stats.averageTicket)}
            icon={<TrendingUp className="h-4 w-4" />}
            iconBg={TOKENS.slate100}
            iconColor={TOKENS.charcoal}
          />
          <KPICard
            label="Productos Bajo Stock"
            value={lowStockProducts.length.toString()}
            icon={<AlertTriangle className="h-4 w-4" />}
            iconBg={lowStockProducts.length > 0 ? TOKENS.redSoft : TOKENS.slate100}
            iconColor={lowStockProducts.length > 0 ? TOKENS.red : TOKENS.charcoal}
            tone={lowStockProducts.length > 0 ? 'danger' : undefined}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Sales Chart */}
          <Panel icon={<BarChart3 className="h-4 w-4" />} title="Ventas por día">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={salesByDay}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={TOKENS.slate200} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    stroke={TOKENS.slate500}
                    fontSize={11}
                    interval="preserveStartEnd"
                    minTickGap={30}
                  />
                  <YAxis
                    tickFormatter={formatShortCurrency}
                    stroke={TOKENS.slate500}
                    fontSize={11}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: 'rgba(18, 24, 38, 0.06)' }}
                  />
                  <Bar dataKey="amount" radius={[2, 2, 0, 0]}>
                    {salesByDay.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isToday ? TOKENS.orange : TOKENS.charcoal}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Today */}
            <div
              className="mt-4 px-4 py-3 rounded flex items-center justify-between"
              style={{
                background: TOKENS.orangeSoft,
                border: `1px solid ${TOKENS.orange}`,
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: TOKENS.orange }}
                />
                <span
                  className="text-[11px] font-bold uppercase tracking-[0.05em]"
                  style={{ color: TOKENS.orange }}
                >
                  Ventas de Hoy
                </span>
              </div>
              <div className="text-right">
                <div
                  className="pm-tnum font-bold text-[20px] leading-7 tracking-[-0.01em]"
                  style={{ color: TOKENS.charcoal }}
                >
                  {formatCurrency(todaySales.amount)}
                </div>
                <div className="text-[12px] pm-tnum" style={{ color: TOKENS.slate500 }}>
                  {todaySales.transactions} transacciones
                </div>
              </div>
            </div>
          </Panel>

          {/* Top Products */}
          <Panel icon={<PieIcon className="h-4 w-4" />} title="Top 5 productos más vendidos">
            {topProducts.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topProducts}
                      dataKey="revenue"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ percent }) =>
                        percent ? `${(percent * 100).toFixed(0)}%` : ''
                      }
                      labelLine={false}
                    >
                      {topProducts.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="square"
                      formatter={(value: string) =>
                        value.length > 20 ? value.substring(0, 20) + '…' : value
                      }
                      wrapperStyle={{ fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div
                className="text-center py-12 text-[13px]"
                style={{ color: TOKENS.slate500 }}
              >
                No hay datos de ventas disponibles.
              </div>
            )}

            {topProducts.length > 0 && (
              <div className="mt-4 space-y-1.5">
                {topProducts.map((product, index) => (
                  <div
                    key={product.sku}
                    className="flex items-center justify-between text-[13px] py-1"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{
                          background: CHART_COLORS[index % CHART_COLORS.length],
                        }}
                      />
                      <span className="truncate" style={{ color: TOKENS.charcoal }}>
                        {product.name}
                      </span>
                    </div>
                    <span
                      className="pm-tnum font-bold shrink-0 pl-3"
                      style={{ color: TOKENS.charcoal }}
                    >
                      {formatCurrency(product.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Low Stock Alert */}
          <div className="lg:col-span-2">
            <Panel
              icon={<AlertTriangle className="h-4 w-4" />}
              title="Alertas de stock bajo"
              counter={
                lowStockProducts.length > 0
                  ? `${lowStockProducts.length} productos`
                  : 'Sin alertas'
              }
              counterTone={lowStockProducts.length > 0 ? 'danger' : 'success'}
            >
              {lowStockProducts.length > 0 ? (
                <div className="overflow-x-auto -mx-4">
                  <table className="min-w-full text-[13px]">
                    <thead>
                      <tr style={{ background: TOKENS.slate100 }}>
                        <Th>SKU</Th>
                        <Th>Producto</Th>
                        <Th align="right">Stock Actual</Th>
                        <Th align="right">Stock Mínimo</Th>
                        <Th align="right">Estado</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStockProducts.map((product) => {
                        const isOut = product.stockQuantity === 0;
                        return (
                          <tr
                            key={product.sku}
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
                                {product.sku}
                              </span>
                            </Td>
                            <Td>
                              <span
                                className="font-semibold"
                                style={{ color: TOKENS.charcoal }}
                              >
                                {product.name}
                              </span>
                            </Td>
                            <Td align="right">
                              <span
                                className="pm-tnum font-bold"
                                style={{ color: isOut ? TOKENS.red : TOKENS.amber }}
                              >
                                {product.stockQuantity}
                              </span>
                            </Td>
                            <Td align="right">
                              <span className="pm-tnum" style={{ color: TOKENS.slate500 }}>
                                {product.minStockAlert || 5}
                              </span>
                            </Td>
                            <Td align="right">
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider"
                                style={{
                                  background: isOut ? TOKENS.redSoft : TOKENS.amberSoft,
                                  color: isOut ? TOKENS.red : TOKENS.amber,
                                }}
                              >
                                {isOut ? 'Agotado' : 'Reordenar'}
                              </span>
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div
                  className="flex items-center gap-2 px-4 py-6 rounded"
                  style={{
                    background: TOKENS.greenSoft,
                    color: TOKENS.green,
                  }}
                >
                  <Package className="h-4 w-4" />
                  <span className="text-[13px] font-semibold">
                    Todos los productos tienen stock suficiente.
                  </span>
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </PMScope>
  );
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

function Panel({
  icon,
  title,
  counter,
  counterTone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  counter?: string;
  counterTone?: 'success' | 'danger';
  children: React.ReactNode;
}) {
  const counterColor =
    counterTone === 'danger'
      ? { bg: TOKENS.redSoft, fg: TOKENS.red }
      : counterTone === 'success'
      ? { bg: TOKENS.greenSoft, fg: TOKENS.green }
      : { bg: TOKENS.slate100, fg: TOKENS.slate500 };
  return (
    <section
      className="rounded overflow-hidden"
      style={{
        background: '#fff',
        border: `1px solid ${TOKENS.slate200}`,
        boxShadow: '0 1px 2px rgba(18, 24, 38, 0.04)',
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: `1px solid ${TOKENS.slate200}`, background: TOKENS.slate50 }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: TOKENS.slate500 }}>{icon}</span>
          <span
            className="text-[11px] font-bold uppercase tracking-[0.05em]"
            style={{ color: TOKENS.slate700 }}
          >
            {title}
          </span>
        </div>
        {counter && (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider"
            style={{ background: counterColor.bg, color: counterColor.fg }}
          >
            {counter}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function KPICard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  tone?: 'danger';
}) {
  return (
    <div
      className="bg-white rounded px-4 py-4 flex items-center justify-between"
      style={{ border: `1px solid ${TOKENS.slate200}` }}
    >
      <div>
        <div
          className="text-[11px] font-bold uppercase tracking-[0.05em]"
          style={{ color: TOKENS.slate500 }}
        >
          {label}
        </div>
        <div
          className="pm-tnum text-[24px] font-bold leading-8 tracking-[-0.02em] mt-1"
          style={{ color: tone === 'danger' ? TOKENS.red : TOKENS.charcoal }}
        >
          {value}
        </div>
      </div>
      <div
        className="flex items-center justify-center h-10 w-10 rounded shrink-0"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
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
