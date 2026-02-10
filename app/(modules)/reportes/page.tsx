"use client";

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Sale, Product, SaleItem } from '@/app/_db/db';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  ShoppingCart,
  Calendar,
  AlertTriangle
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
  Legend
} from 'recharts';

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

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

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
  const [salesByDay, setSalesByDay] = useState<{ date: string; amount: number; isToday?: boolean }[]>([]);
  const [todaySales, setTodaySales] = useState<{ amount: number; transactions: number }>({ amount: 0, transactions: 0 });

  const sales = useLiveQuery(() => db.sales.toArray(), []);
  const products = useLiveQuery(() => db.products.toArray(), []);
  const saleItems = useLiveQuery(() => db.saleItems.toArray(), []);

  useEffect(() => {
    if (!sales || !products || !saleItems) return;

    // Calculate date range
    const now = new Date();
    const daysAgo = dateRange === 'all' ? 3650 : parseInt(dateRange); // 10 years for "all"
    
    // Create start date at beginning of day (00:00:00) to include full days
    const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);
    
    // Create end date at end of day (23:59:59) to include today's sales
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    // Filter sales by date using date strings to avoid timezone issues
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    const filteredSales = sales.filter(sale => {
      const saleDateStr = new Date(sale.date).toISOString().split('T')[0];
      return saleDateStr >= startDateStr && saleDateStr <= endDateStr;
    });

    // Calculate stats
    const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.totalAmountUsd, 0);
    const totalTransactions = filteredSales.length;
    const averageTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    setStats({
      totalSales: totalRevenue,
      totalRevenue,
      totalTransactions,
      averageTicket,
    });

    // Calculate today's sales specifically
    const todayStr = now.toISOString().split('T')[0];
    const todaySalesData = sales.filter(sale => {
      const saleDateStr = new Date(sale.date).toISOString().split('T')[0];
      return saleDateStr === todayStr;
    });
    const todayTotal = todaySalesData.reduce((sum, sale) => sum + sale.totalAmountUsd, 0);
    setTodaySales({
      amount: todayTotal,
      transactions: todaySalesData.length
    });

    // Calculate top products
    const productSales: { [key: string]: { name: string; quantity: number; revenue: number } } = {};
    
    filteredSales.forEach(sale => {
      const items = saleItems.filter(item => item.saleId === sale.id);
      items.forEach(item => {
        const product = products.find(p => p.sku === item.productId);
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
        revenue: data.revenue 
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    setTopProducts(sortedProducts);

    // Low stock products
    const lowStock = products.filter(p => p.stockQuantity <= (p.minStockAlert || 5));
    setLowStockProducts(lowStock);

    // Sales by day - adapt to selected date range
    const daysToShow = dateRange === 'all' 
      ? Math.min(90, Math.ceil((now.getTime() - Math.min(...sales.map(s => new Date(s.date).getTime()))) / (1000 * 60 * 60 * 24)))
      : parseInt(dateRange);
    
    const salesByDayData: { date: string; amount: number; isToday?: boolean }[] = [];
    
    // Generate array of dates from start to end
    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      
      // Sum all sales for this day
      const daySales = sales.filter(sale => {
        const saleDateStr = new Date(sale.date).toISOString().split('T')[0];
        return saleDateStr === dateStr;
      });
      
      const dayTotal = daySales.reduce((sum, sale) => sum + sale.totalAmountUsd, 0);
      const isToday = i === 0;
      salesByDayData.push({ date: dateStr, amount: dayTotal, isToday });
    }
    setSalesByDay(salesByDayData);

  }, [sales, products, saleItems, dateRange]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    // For larger ranges, show month/day, for smaller ranges show weekday/day
    if (dateRange === '30' || dateRange === '90' || dateRange === 'all') {
      return date.toLocaleDateString('es-VE', { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric' });
  };

  const formatShortCurrency = (value: number) => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}k`;
    }
    return `$${value}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 text-white text-xs px-3 py-2 rounded shadow-lg">
          <p className="font-semibold mb-1">
            {data.isToday ? 'Hoy' : new Date(label).toLocaleDateString('es-VE', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
          <p>{formatCurrency(data.amount)}</p>
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-gray-800 text-white text-xs px-3 py-2 rounded shadow-lg">
          <p className="font-semibold mb-1">{data.name}</p>
          <p>{formatCurrency(data.value)}</p>
          <p className="text-gray-300">{data.payload.quantitySold} unidades</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold">Dashboard de Reportes</h1>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
            <option value="all">Todo el tiempo</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Ingresos Totales</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Transacciones</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalTransactions}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Ticket Promedio</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.averageTicket)}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Productos Bajo Stock</p>
              <p className="text-2xl font-bold text-gray-900">{lowStockProducts.length}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart - Recharts BarChart */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-4">
            {dateRange === 'all' ? 'Ventas Históricas' : dateRange === '7' ? 'Ventas Últimos 7 Días (incluye hoy)' : `Ventas Últimos ${dateRange} Días`}
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesByDay} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  stroke="#6b7280"
                  fontSize={12}
                  interval="preserveStartEnd"
                  minTickGap={30}
                />
                <YAxis 
                  tickFormatter={formatShortCurrency}
                  stroke="#6b7280"
                  fontSize={12}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
                <Bar 
                  dataKey="amount" 
                  radius={[4, 4, 0, 0]}
                  fill="#3b82f6"
                >
                  {salesByDay.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.isToday ? '#10b981' : '#3b82f6'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          {/* Today's Sales Summary */}
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-semibold text-green-800">Ventas de Hoy</span>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-700">{formatCurrency(todaySales.amount)}</p>
                <p className="text-sm text-green-600">{todaySales.transactions} transacciones</p>
              </div>
            </div>
          </div>
        </div>

        {/* Top Products - Recharts PieChart */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-4">Top 5 Productos Más Vendidos</h2>
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
                    label={({ name, percent }) => percent ? `${(percent * 100).toFixed(0)}%` : ''}
                    labelLine={false}
                  >
                    {topProducts.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    iconType="circle"
                    formatter={(value: string) => value.length > 20 ? value.substring(0, 20) + '...' : value}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No hay datos de ventas disponibles.</p>
          )}
          
          {/* Top Products List */}
          {topProducts.length > 0 && (
            <div className="mt-4 space-y-2">
              {topProducts.map((product, index) => (
                <div key={product.sku} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-gray-700">{product.name}</span>
                  </div>
                  <span className="font-semibold text-gray-900">{formatCurrency(product.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alert */}
        <div className="bg-white p-6 rounded-lg shadow-md lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold">Alertas de Stock Bajo</h2>
          </div>
          {lowStockProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-sm font-medium text-gray-600">SKU</th>
                    <th className="text-left py-2 text-sm font-medium text-gray-600">Producto</th>
                    <th className="text-center py-2 text-sm font-medium text-gray-600">Stock Actual</th>
                    <th className="text-center py-2 text-sm font-medium text-gray-600">Stock Mínimo</th>
                    <th className="text-right py-2 text-sm font-medium text-gray-600">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockProducts.map((product) => (
                    <tr key={product.sku} className="border-b last:border-b-0">
                      <td className="py-3 text-sm font-mono">{product.sku}</td>
                      <td className="py-3 text-sm font-medium">{product.name}</td>
                      <td className="py-3 text-sm text-center font-semibold text-red-600">{product.stockQuantity}</td>
                      <td className="py-3 text-sm text-center text-gray-600">{product.minStockAlert || 5}</td>
                      <td className="py-3 text-sm text-right">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                          Reordenar
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-600">
              <Package className="w-5 h-5" />
              <p>Todos los productos tienen stock suficiente.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
