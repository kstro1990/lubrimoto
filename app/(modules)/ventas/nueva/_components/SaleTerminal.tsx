"use client";

import React, { useState, useEffect } from 'react';
import { db, Product, Customer, Sale, SaleItem, Payment, SyncStatus, recordInventoryMovement, MovementType } from '@/app/_db/db';
import { supabase } from '@/app/_lib/supabase';
import { syncPendingData } from '@/app/_lib/sync';
import { printFiscalInvoice } from '@/app/_lib/printing';
import { useNotifications } from '@/app/_components/NotificationProvider';
import { useTasas } from '@/app/_contexts/TasasContext';
import { logInfo, logError, logWarn } from '@/app/_lib/logger';
import ProductSearch from '@/app/_components/ui/ProductSearch';

// Tasas fiscales Venezuela (configurables en un futuro desde DB/settings)
const IVA_RATE = 0.16; // 16% IVA
const IGTF_RATE = 0.03; // 3% IGTF - aplica a pagos en divisas/cripto

interface CartItem extends Product {
  quantity: number;
}

type PaymentMethod = Payment['method'];

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'usd_cash', label: 'Efectivo USD' },
  { value: 'ves_transfer', label: 'Transferencia VES' },
  { value: 'pago_movil', label: 'Pago Móvil' },
  { value: 'debit_card', label: 'Tarjeta Débito' },
];

export default function SaleTerminal() {
  const { success, error: showError } = useNotifications();
  const { tasas } = useTasas();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<Partial<Customer>>({ name: '', email: '' });
  const [total, setTotal] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [applyIgtf, setApplyIgtf] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('usd_cash');
  const [paymentReference, setPaymentReference] = useState<string>('');

  // Tasa de cambio: usa la tasa BCV del contexto, o 0 si no hay tasas cargadas
  const exchangeRate = tasas?.bcv ?? 0;

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
      if (!exchangeRate || exchangeRate <= 0) {
        showError('Sin Tasa de Cambio', 'No hay tasa de cambio disponible. Sincroniza las tasas desde el módulo de Tasas Cambiarias.', 6000);
        setIsProcessing(false);
        return;
      }

      const now = new Date();
      const subtotal = total;
      const iva = Math.round(subtotal * IVA_RATE * 100) / 100;
      const igtf = applyIgtf ? Math.round(subtotal * IGTF_RATE * 100) / 100 : 0;
      const totalWithTax = Math.round((subtotal + iva + igtf) * 100) / 100;
      const totalInVes = Math.round(totalWithTax * exchangeRate * 100) / 100;

      const resultSaleId = await db.transaction('rw', [db.products, db.customers, db.sales, db.saleItems, db.payments, db.inventoryMovements], async () => {
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
              syncUuid: crypto.randomUUID(),
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
          syncUuid: crypto.randomUUID(),
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
            syncUuid: crypto.randomUUID(),
          });

          // Update product stock
          const product = await db.products.get(item.id);
          if (product) {
            if (product.stockQuantity < item.quantity) {
              throw new Error(`Stock insuficiente para ${product.name}. Disponible: ${product.stockQuantity}, Solicitado: ${item.quantity}`);
            }
            const newStock = product.stockQuantity - item.quantity;
            await db.products.update(item.id!, {
              stockQuantity: newStock,
              updatedAt: now,
              syncStatus: SyncStatus.PENDING,
            });

            // Record inventory movement for audit trail
            await recordInventoryMovement(
              { ...product, stockQuantity: newStock },
              MovementType.SALE,
              -item.quantity,
              sId,
              `Venta #${sId} - ${item.quantity} unidad(es)`
            );
          } else {
            throw new Error(`Producto ${item.name} no encontrado en la base de datos.`);
          }
        }

        // 4. Record Payment
        await db.payments.add({
          saleId: sId,
          method: paymentMethod,
          amount: totalWithTax,
          referenceCode: paymentReference.trim() || undefined,
          createdAt: now,
          updatedAt: now,
          syncStatus: SyncStatus.PENDING,
          syncUuid: crypto.randomUUID(),
        });

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

      // Sincronizar automáticamente con Supabase (no bloquea la venta)
      syncPendingData()
        .then((syncResult) => {
          if (syncResult.synced > 0) {
            logInfo('Sync after sale', 'SaleTerminal', { synced: syncResult.synced });
          }
          if (!syncResult.success && syncResult.errors.length > 0) {
            logWarn('Sync after sale had errors', 'SaleTerminal', { errors: syncResult.errors });
          }
        })
        .catch((syncErr) => {
          logWarn('Sync after sale failed, will retry later', 'SaleTerminal', { error: String(syncErr) });
        });

      setCart([]);
      setCustomer({ name: '', email: '' });
      setTotal(0);
      setPaymentMethod('usd_cash');
      setPaymentReference('');

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

          {/* Payment Method */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Método de Pago</label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPaymentMethod(value)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    paymentMethod === value
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {(paymentMethod === 'ves_transfer' || paymentMethod === 'pago_movil') && (
            <div className="mb-4">
              <label htmlFor="paymentRef" className="block text-sm font-medium text-gray-700">
                Nro. de Referencia
              </label>
              <input
                type="text"
                id="paymentRef"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border px-3 py-2"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Nro. de referencia o confirmación"
              />
            </div>
          )}

          {/* Desglose fiscal */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal:</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">IVA ({(IVA_RATE * 100).toFixed(0)}%):</span>
              <span>${(Math.round(total * IVA_RATE * 100) / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <label className="text-gray-600 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyIgtf}
                  onChange={(e) => setApplyIgtf(e.target.checked)}
                  className="rounded border-gray-300"
                />
                IGTF ({(IGTF_RATE * 100).toFixed(0)}%):
              </label>
              <span>${applyIgtf ? (Math.round(total * IGTF_RATE * 100) / 100).toFixed(2) : '0.00'}</span>
            </div>
            <div className="border-t pt-1 flex justify-between font-bold text-base">
              <span>Total USD:</span>
              <span>${(Math.round((total + total * IVA_RATE + (applyIgtf ? total * IGTF_RATE : 0)) * 100) / 100).toFixed(2)}</span>
            </div>
            {exchangeRate > 0 && (
              <div className="flex justify-between text-gray-500 text-xs pt-1">
                <span>Tasa BCV: Bs. {exchangeRate.toFixed(2)}</span>
                <span>≈ Bs. {(Math.round((total + total * IVA_RATE + (applyIgtf ? total * IGTF_RATE : 0)) * exchangeRate * 100) / 100).toFixed(2)}</span>
              </div>
            )}
            {!exchangeRate || exchangeRate <= 0 ? (
              <p className="text-red-500 text-xs mt-1">Sin tasa de cambio. Sincroniza desde Tasas Cambiarias.</p>
            ) : null}
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
