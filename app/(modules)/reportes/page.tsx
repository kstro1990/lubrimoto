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
  const [salesByDay, setSalesByDay] = useState<{ date: string; amount: number }[]>([]);
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
    
    const salesByDayData: { date: string; amount: number }[] = [];
    
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
      salesByDayData.push({ date: dateStr, amount: dayTotal });
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
        {/* Sales Chart */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-4">
            {dateRange === 'all' ? 'Ventas Históricas' : dateRange === '7' ? 'Ventas Últimos 7 Días (incluye hoy)' : `Ventas Últimos ${dateRange} Días`}
          </h2>
          <div className="h-64 flex items-end justify-between gap-1">
            {salesByDay.map((day, index) => {
              const maxAmount = Math.max(...salesByDay.map(d => d.amount), 1);
              const height = maxAmount > 0 ? (day.amount / maxAmount) * 100 : 0;
              
              // Check if this is today's column (last one)
              const isToday = index === salesByDay.length - 1;
              
              // Determine label frequency based on number of days
              const totalDays = salesByDay.length;
              let showLabel = true;
              
              if (totalDays > 60) {
                // For 90 days, show every 5th label
                showLabel = index % 5 === 0 || index === totalDays - 1;
              } else if (totalDays > 30) {
                // For 60 days, show every 3rd label
                showLabel = index % 3 === 0 || index === totalDays - 1;
              } else if (totalDays > 14) {
                // For 30 days, show every 2nd label
                showLabel = index % 2 === 0 || index === totalDays - 1;
              }
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                  <div className="w-full relative">
                    <div 
                      className={`w-full rounded-t transition-all duration-500 ${
                        isToday 
                          ? 'bg-green-500 hover:bg-green-600 ring-2 ring-green-400' 
                          : 'bg-blue-500 hover:bg-blue-600'
                      }`}
                      style={{ height: `${Math.max(height, 4)}%`, minHeight: '4px' }}
                    />
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {formatCurrency(day.amount)}
                    </div>
                  </div>
                  {showLabel && (
                    <span className={`text-xs truncate max-w-full ${isToday ? 'text-green-600 font-bold' : 'text-gray-600'}`}>
                      {isToday ? 'Hoy' : formatDate(day.date)}
                    </span>
                  )}
                </div>
              );
            })}
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

        {/* Top Products */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-4">Top 5 Productos Más Vendidos</h2>
          {topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.map((product, index) => (
                <div key={product.sku} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-500">{product.quantitySold} unidades</p>
                    </div>
                  </div>
                  <p className="font-semibold text-gray-900">{formatCurrency(product.revenue)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No hay datos de ventas disponibles.</p>
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
