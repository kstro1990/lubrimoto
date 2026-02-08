"use client";

import React, { useState, useEffect } from 'react';
import { db, Product, Customer, Sale, SaleItem, SyncStatus } from '@/app/_db/db';
import { supabase } from '@/app/_lib/supabase';
import { printFiscalInvoice } from '@/app/_lib/printing';
import { useNotifications } from '@/app/_components/NotificationProvider';
import { logInfo, logError, logWarn } from '@/app/_lib/logger';
import ProductSearch from '@/app/_components/ui/ProductSearch';

interface CartItem extends Product {
  quantity: number;
}

export default function SaleTerminal() {
  const { success, error: showError } = useNotifications();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<Partial<Customer>>({ name: '', email: '' });
  const [total, setTotal] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [products, setProducts] = useState<Product[]>([]);

  // Effect to calculate total whenever cart changes
  useEffect(() => {
    const newTotal = cart.reduce((sum, item) => sum + item.quantity * item.priceUsd, 0);
    setTotal(newTotal);
  }, [cart]);

  // Effect to load initial products
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const fetchedProducts = await db.products.toArray();
        setProducts(fetchedProducts);
        logInfo('Products loaded successfully', 'SaleTerminal', { count: fetchedProducts.length });
      } catch (error) {
        logError('Error loading products', error as Error, 'SaleTerminal');
        showError('Error', 'No se pudieron cargar los productos', 5000);
      }
    };
    loadProducts();
  }, []);

  const handleFinalizeSale = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);

    try {
      const now = new Date();
      const exchangeRate = 36.50; // Should come from settings or API
      const subtotal = total;
      const iva = subtotal * 0.16;
      const igtf = 0;
      const totalWithTax = subtotal + iva + igtf;
      const totalInVes = totalWithTax * exchangeRate;

      const resultSaleId = await db.transaction('rw', [db.products, db.customers, db.sales, db.saleItems], async () => {
        let currentCustomerId: number | undefined = undefined;

        // 1. Handle Customer
        if (customer.name && customer.name.trim() !== '') {
          const existingCustomer = await db.customers.where('name').equalsIgnoreCase(customer.name).first();
          if (existingCustomer) {
            currentCustomerId = existingCustomer.id;
          } else {
            currentCustomerId = await db.customers.add({
              name: customer.name,
              email: customer.email || '',
              createdAt: now,
              updatedAt: now,
              syncStatus: SyncStatus.PENDING,
            });
          }
        }

        // 2. Create Sale
        const sId = await db.sales.add({
          customerId: currentCustomerId,
          subtotalUsd: subtotal,
          ivaAmountUsd: iva,
          igtfAmountUsd: igtf,
          totalAmountUsd: totalWithTax,
          exchangeRateVes: exchangeRate,
          totalAmountVes: totalInVes,
          date: now,
          createdAt: now,
          updatedAt: now,
          syncStatus: SyncStatus.PENDING,
        });

        // 3. Create Items and Update Stock
        for (const item of cart) {
          await db.saleItems.add({
            saleId: sId,
            productId: item.sku,
            quantity: item.quantity,
            pricePerUnitUsd: item.priceUsd,
            createdAt: now,
            updatedAt: now,
            syncStatus: SyncStatus.PENDING,
          });

          // Update product stock
          const product = await db.products.get(item.id);
          if (product) {
            if (product.stockQuantity < item.quantity) {
              throw new Error(`Stock insuficiente para ${product.name}. Disponible: ${product.stockQuantity}, Solicitado: ${item.quantity}`);
            }
            await db.products.update(item.id!, {
              stockQuantity: product.stockQuantity - item.quantity,
              updatedAt: now,
              syncStatus: SyncStatus.PENDING,
            });
          } else {
            throw new Error(`Producto ${item.name} no encontrado en la base de datos.`);
          }
        }

        return sId;
      });

      // Post-sale actions
      const finalSale = await db.sales.get(resultSaleId);
      if (!finalSale) throw new Error("No se pudo recuperar la venta.");

      const finalCustomer = finalSale.customerId ? await db.customers.get(finalSale.customerId) : undefined;

      // Print invoice
      printFiscalInvoice({ sale: finalSale, items: cart, customer: finalCustomer });

      // Send email if customer has email
      if (finalCustomer?.email && supabase) {
        await supabase.functions.invoke('send-invoice-email', {
          body: { sale: finalSale, items: cart, customer: finalCustomer },
        });
        logInfo('Invoice email sent', 'SaleTerminal', { saleId: resultSaleId, customerEmail: finalCustomer.email });
      }

      logInfo('Sale completed successfully', 'SaleTerminal', { 
        saleId: resultSaleId, 
        total: totalWithTax,
        items: cart.length 
      });

      success(
        'Venta Finalizada',
        `Venta #${resultSaleId} procesada exitosamente. Total: $${totalWithTax.toFixed(2)}`,
        5000
      );
      setCart([]);
      setCustomer({ name: '', email: '' });
      setTotal(0);

    } catch (err: any) {
      logError('Error processing sale', err instanceof Error ? err : new Error(String(err)), 'SaleTerminal', {
        cartItems: cart.length,
        customerName: customer.name,
      });
      showError(
        'Error al Procesar Venta',
        err.message || 'Verifica el stock disponible y los datos.',
        8000
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddToCart = (product: Product, quantity: number) => {
    if (quantity <= 0) return;

    const existingItemIndex = cart.findIndex(item => item.sku === product.sku);
    if (existingItemIndex > -1) {
      const updatedCart = [...cart];
      const existingItem = updatedCart[existingItemIndex];
      if (product.stockQuantity < existingItem.quantity + quantity) {
        showError(
          'Stock Insuficiente',
          `${product.name}: Disponible ${product.stockQuantity}, en carrito: ${existingItem.quantity}`,
          4000
        );
        return;
      }
      updatedCart[existingItemIndex] = { ...existingItem, quantity: existingItem.quantity + quantity };
      setCart(updatedCart);
    } else {
      if (product.stockQuantity < quantity) {
        showError(
          'Stock Insuficiente',
          `${product.name}: Disponible ${product.stockQuantity}`,
          4000
        );
        return;
      }
      setCart([...cart, { ...product, quantity }]);
    }
  };

  const handleRemoveFromCart = (productSku: string) => {
    setCart(cart.filter(item => item.sku !== productSku));
  };

  return (
    <div className="container mx-auto p-4 flex flex-col lg:flex-row gap-8">
      {/* Product Selection Area */}
      <div className="flex-1 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4">Selección de Productos</h2>
        
        {/* Product Search */}
        <div className="mb-6">
          <ProductSearch
            onSelect={(product) => handleAddToCart(product, 1)}
            placeholder="Buscar producto por nombre, SKU o código de barras..."
            showResults={true}
            autoFocus={true}
            filterInStock={true}
          />
          <p className="text-sm text-gray-500 mt-2">
            Escribe para buscar o usa <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Ctrl+K</kbd> para enfocar
          </p>
        </div>

        {/* Recently Added / Quick Access */}
        {products.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Productos disponibles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-80 overflow-y-auto">
              {products.slice(0, 10).map(product => (
                <div key={product.sku} className="border p-4 rounded-lg flex justify-between items-center hover:border-blue-300 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{product.name}</p>
                    <p className="text-sm text-gray-600">${product.priceUsd.toFixed(2)} | Stock: {product.stockQuantity}</p>
                  </div>
                  <button
                    onClick={() => handleAddToCart(product, 1)}
                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 disabled:opacity-50 ml-2 flex-shrink-0"
                    disabled={product.stockQuantity <= 0}
                  >
                    Agregar
                  </button>
                </div>
              ))}
            </div>
            {products.length > 10 && (
              <p className="text-center text-sm text-gray-500 mt-3">
                Y {products.length - 10} productos más. Usa la búsqueda para encontrarlos rápidamente.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Cart and Finalize Area */}
      <div className="lg:w-1/3 bg-white p-6 rounded-lg shadow-md flex flex-col">
        <h2 className="text-2xl font-semibold mb-4">Carrito de Compras</h2>
        <div className="flex-1 overflow-y-auto mb-4">
          {cart.length === 0 ? (
            <p className="text-gray-500">El carrito está vacío.</p>
          ) : (
            <ul>
              {cart.map(item => (
                <li key={item.sku} className="flex justify-between items-center py-2 border-b last:border-b-0">
                  <div>
                    <p className="font-medium">{item.name} (x{item.quantity})</p>
                    <p className="text-sm text-gray-600">${(item.priceUsd * item.quantity).toFixed(2)}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveFromCart(item.sku)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-auto pt-4 border-t">
          {/* Customer Input */}
          <div className="mb-4">
            <label htmlFor="customerName" className="block text-sm font-medium text-gray-700">Nombre del Cliente</label>
            <input
              type="text"
              id="customerName"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border px-3 py-2"
              value={customer.name}
              onChange={(e) => setCustomer(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Opcional"
            />
          </div>
          <div className="mb-6">
            <label htmlFor="customerEmail" className="block text-sm font-medium text-gray-700">Email del Cliente</label>
            <input
              type="email"
              id="customerEmail"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border px-3 py-2"
              value={customer.email || ''}
              onChange={(e) => setCustomer(prev => ({ ...prev, email: e.target.value }))}
              placeholder="Opcional, para enviar factura"
            />
          </div>

          <div className="text-right text-3xl font-bold mb-6">
            Total: ${total.toFixed(2)}
          </div>
          <button
            onClick={handleFinalizeSale}
            disabled={cart.length === 0 || isProcessing}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
          >
            {isProcessing ? 'Procesando...' : 'Finalizar Venta'}
          </button>
        </div>
      </div>
    </div>
  );
}
