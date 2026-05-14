"use client";

import React, { useState, useEffect } from 'react';
import {
  db,
  Product,
  Customer,
  Payment,
  SyncStatus,
  recordInventoryMovement,
  MovementType,
} from '@/app/_db/db';
import { supabase } from '@/app/_lib/supabase';
import { syncPendingData } from '@/app/_lib/sync';
import { printFiscalInvoice } from '@/app/_lib/printing';
import { useNotifications } from '@/app/_components/NotificationProvider';
import { useTasas } from '@/app/_contexts/TasasContext';
import { logInfo, logError, logWarn } from '@/app/_lib/logger';
import ProductSearch from '@/app/_components/ui/ProductSearch';
import {
  ShoppingCart,
  X,
  Plus,
  CreditCard,
  Banknote,
  Smartphone,
  Receipt,
  AlertCircle,
} from 'lucide-react';
import { TOKENS, PMBtnPrimary } from '@/app/_components/_pmTheme';

const IVA_RATE = 0.16;
const IGTF_RATE = 0.03;

interface CartItem extends Product {
  quantity: number;
}

type PaymentMethod = Payment['method'];

const PAYMENT_METHODS: {
  value: PaymentMethod;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: 'usd_cash', label: 'Efectivo USD', icon: <Banknote className="h-3.5 w-3.5" /> },
  { value: 'ves_transfer', label: 'Transferencia VES', icon: <CreditCard className="h-3.5 w-3.5" /> },
  { value: 'pago_movil', label: 'Pago Móvil', icon: <Smartphone className="h-3.5 w-3.5" /> },
  { value: 'debit_card', label: 'Tarjeta Débito', icon: <CreditCard className="h-3.5 w-3.5" /> },
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

  const exchangeRate = tasas?.bcv ?? 0;

  useEffect(() => {
    const newTotal = cart.reduce((sum, item) => sum + item.quantity * item.priceUsd, 0);
    setTotal(newTotal);
  }, [cart]);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const fetchedProducts = await db.products.toArray();
        setProducts(fetchedProducts);
        logInfo('Products loaded successfully', 'SaleTerminal', {
          count: fetchedProducts.length,
        });
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
        showError(
          'Sin Tasa de Cambio',
          'No hay tasa de cambio disponible. Sincroniza las tasas desde el módulo de Tasas Cambiarias.',
          6000,
        );
        setIsProcessing(false);
        return;
      }

      const now = new Date();
      const subtotal = total;
      const iva = Math.round(subtotal * IVA_RATE * 100) / 100;
      const igtf = applyIgtf ? Math.round(subtotal * IGTF_RATE * 100) / 100 : 0;
      const totalWithTax = Math.round((subtotal + iva + igtf) * 100) / 100;
      const totalInVes = Math.round(totalWithTax * exchangeRate * 100) / 100;

      const resultSaleId = await db.transaction(
        'rw',
        [db.products, db.customers, db.sales, db.saleItems, db.payments, db.inventoryMovements],
        async () => {
          let currentCustomerId: number | undefined = undefined;

          if (customer.name && customer.name.trim() !== '') {
            const existingCustomer = await db.customers
              .where('name')
              .equalsIgnoreCase(customer.name)
              .first();
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

            const product = await db.products.get(item.id);
            if (product) {
              if (product.stockQuantity < item.quantity) {
                throw new Error(
                  `Stock insuficiente para ${product.name}. Disponible: ${product.stockQuantity}, Solicitado: ${item.quantity}`,
                );
              }
              const newStock = product.stockQuantity - item.quantity;
              await db.products.update(item.id!, {
                stockQuantity: newStock,
                updatedAt: now,
                syncStatus: SyncStatus.PENDING,
              });

              await recordInventoryMovement(
                { ...product, stockQuantity: newStock },
                MovementType.SALE,
                -item.quantity,
                sId,
                `Venta #${sId} - ${item.quantity} unidad(es)`,
              );
            } else {
              throw new Error(`Producto ${item.name} no encontrado en la base de datos.`);
            }
          }

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
        },
      );

      const finalSale = await db.sales.get(resultSaleId);
      if (!finalSale) throw new Error('No se pudo recuperar la venta.');

      const finalCustomer = finalSale.customerId
        ? await db.customers.get(finalSale.customerId)
        : undefined;

      printFiscalInvoice({ sale: finalSale, items: cart, customer: finalCustomer });

      if (finalCustomer?.email && supabase) {
        await supabase.functions.invoke('send-invoice-email', {
          body: { sale: finalSale, items: cart, customer: finalCustomer },
        });
        logInfo('Invoice email sent', 'SaleTerminal', {
          saleId: resultSaleId,
          customerEmail: finalCustomer.email,
        });
      }

      logInfo('Sale completed successfully', 'SaleTerminal', {
        saleId: resultSaleId,
        total: totalWithTax,
        items: cart.length,
      });

      success(
        'Venta Finalizada',
        `Venta #${resultSaleId} procesada exitosamente. Total: $${totalWithTax.toFixed(2)}`,
        5000,
      );

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
          logWarn('Sync after sale failed, will retry later', 'SaleTerminal', {
            error: String(syncErr),
          });
        });

      setCart([]);
      setCustomer({ name: '', email: '' });
      setTotal(0);
      setPaymentMethod('usd_cash');
      setPaymentReference('');
    } catch (err: any) {
      logError(
        'Error processing sale',
        err instanceof Error ? err : new Error(String(err)),
        'SaleTerminal',
        {
          cartItems: cart.length,
          customerName: customer.name,
        },
      );
      showError(
        'Error al Procesar Venta',
        err.message || 'Verifica el stock disponible y los datos.',
        8000,
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddToCart = (product: Product, quantity: number) => {
    if (quantity <= 0) return;

    const existingItemIndex = cart.findIndex((item) => item.sku === product.sku);
    if (existingItemIndex > -1) {
      const updatedCart = [...cart];
      const existingItem = updatedCart[existingItemIndex];
      if (product.stockQuantity < existingItem.quantity + quantity) {
        showError(
          'Stock Insuficiente',
          `${product.name}: Disponible ${product.stockQuantity}, en carrito: ${existingItem.quantity}`,
          4000,
        );
        return;
      }
      updatedCart[existingItemIndex] = {
        ...existingItem,
        quantity: existingItem.quantity + quantity,
      };
      setCart(updatedCart);
    } else {
      if (product.stockQuantity < quantity) {
        showError(
          'Stock Insuficiente',
          `${product.name}: Disponible ${product.stockQuantity}`,
          4000,
        );
        return;
      }
      setCart([...cart, { ...product, quantity }]);
    }
  };

  const handleRemoveFromCart = (productSku: string) => {
    setCart(cart.filter((item) => item.sku !== productSku));
  };

  const totalIva = Math.round(total * IVA_RATE * 100) / 100;
  const totalIgtf = applyIgtf ? Math.round(total * IGTF_RATE * 100) / 100 : 0;
  const grandTotal = Math.round((total + totalIva + totalIgtf) * 100) / 100;

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Product Selection */}
      <div className="flex-1 pm-card p-5">
        <h2 className="pm-section-title">
          <ShoppingCart className="h-4 w-4" style={{ color: TOKENS.slate500 }} />
          Selección de Productos
        </h2>

        <div className="mb-4">
          <ProductSearch
            onSelect={(product) => handleAddToCart(product, 1)}
            placeholder="Buscar producto por nombre, SKU o código de barras…"
            showResults={true}
            autoFocus={true}
            filterInStock={true}
          />
          <p className="text-[11px] mt-2" style={{ color: TOKENS.slate500 }}>
            Escribe para buscar o usa{' '}
            <kbd
              className="px-1 py-0.5 rounded text-[10px] font-bold tracking-wider"
              style={{
                background: TOKENS.slate100,
                border: `1px solid ${TOKENS.slate200}`,
                color: TOKENS.slate700,
              }}
            >
              ⌘K
            </kbd>{' '}
            para enfocar
          </p>
        </div>

        {products.length > 0 && (
          <div className="mt-4">
            <div className="pm-eyebrow mb-2">Productos disponibles</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
              {products.slice(0, 12).map((product) => (
                <div
                  key={product.sku}
                  className="flex justify-between items-center p-3 rounded transition-colors"
                  style={{
                    background: '#fff',
                    border: `1px solid ${TOKENS.slate200}`,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[13px] font-semibold truncate"
                      style={{ color: TOKENS.charcoal }}
                    >
                      {product.name}
                    </p>
                    <p
                      className="text-[11px] pm-tnum mt-0.5"
                      style={{ color: TOKENS.slate500 }}
                    >
                      <span className="font-bold">${product.priceUsd.toFixed(2)}</span> · Stock:{' '}
                      {product.stockQuantity}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAddToCart(product, 1)}
                    disabled={product.stockQuantity <= 0}
                    className="ml-2 inline-flex items-center justify-center h-8 w-8 rounded transition-colors disabled:opacity-40"
                    style={{ background: TOKENS.charcoal, color: '#fff' }}
                    title="Agregar al carrito"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            {products.length > 12 && (
              <p
                className="text-center text-[12px] mt-3"
                style={{ color: TOKENS.slate500 }}
              >
                Y {products.length - 12} productos más. Usa la búsqueda para encontrarlos.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Cart / Checkout */}
      <div className="lg:w-[400px] pm-card p-5 flex flex-col">
        <h2 className="pm-section-title">
          <Receipt className="h-4 w-4" style={{ color: TOKENS.slate500 }} />
          Carrito · Checkout
        </h2>

        <div className="flex-1 overflow-y-auto mb-4 -mx-1 px-1 max-h-72">
          {cart.length === 0 ? (
            <div
              className="text-center py-8 text-[13px]"
              style={{ color: TOKENS.slate500 }}
            >
              <ShoppingCart
                className="h-8 w-8 mx-auto mb-2"
                style={{ color: TOKENS.slate300 }}
              />
              El carrito está vacío.
            </div>
          ) : (
            <ul className="space-y-2">
              {cart.map((item) => (
                <li
                  key={item.sku}
                  className="flex justify-between items-start gap-2 px-3 py-2 rounded"
                  style={{
                    background: TOKENS.slate50,
                    border: `1px solid ${TOKENS.slate200}`,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-[13px] font-semibold truncate"
                      style={{ color: TOKENS.charcoal }}
                    >
                      {item.name}
                    </p>
                    <p className="text-[11px] pm-tnum" style={{ color: TOKENS.slate500 }}>
                      {item.quantity} × ${item.priceUsd.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className="text-[13px] font-bold pm-tnum"
                      style={{ color: TOKENS.charcoal }}
                    >
                      ${(item.priceUsd * item.quantity).toFixed(2)}
                    </p>
                    <button
                      onClick={() => handleRemoveFromCart(item.sku)}
                      className="text-[11px] mt-0.5 inline-flex items-center gap-0.5"
                      style={{ color: TOKENS.red }}
                    >
                      <X className="h-3 w-3" />
                      Quitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className="pt-4 space-y-4"
          style={{ borderTop: `1px solid ${TOKENS.slate200}` }}
        >
          {/* Customer */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label htmlFor="customerName" className="pm-label">
                Nombre del Cliente
              </label>
              <input
                type="text"
                id="customerName"
                className="pm-input"
                value={customer.name}
                onChange={(e) => setCustomer((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
            <div>
              <label htmlFor="customerEmail" className="pm-label">
                Email
              </label>
              <input
                type="email"
                id="customerEmail"
                className="pm-input"
                value={customer.email || ''}
                onChange={(e) => setCustomer((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="Opcional, para enviar factura"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="pm-label">Método de Pago</label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map(({ value, label, icon }) => {
                const active = paymentMethod === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPaymentMethod(value)}
                    className="inline-flex items-center justify-center gap-1.5 px-2 h-9 text-[12px] font-semibold rounded transition-colors"
                    style={{
                      background: active ? TOKENS.charcoal : '#fff',
                      color: active ? '#fff' : TOKENS.charcoal,
                      border: `1px solid ${active ? TOKENS.charcoal : TOKENS.slate300}`,
                    }}
                  >
                    {icon}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {(paymentMethod === 'ves_transfer' || paymentMethod === 'pago_movil') && (
            <div>
              <label htmlFor="paymentRef" className="pm-label">
                Nro. de Referencia
              </label>
              <input
                type="text"
                id="paymentRef"
                className="pm-input"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Nro. de referencia o confirmación"
              />
            </div>
          )}

          {/* Tax breakdown */}
          <div
            className="rounded px-3 py-3 space-y-1 text-[13px]"
            style={{
              background: TOKENS.slate50,
              border: `1px solid ${TOKENS.slate200}`,
            }}
          >
            <Row label="Subtotal" value={`$${total.toFixed(2)}`} />
            <Row
              label={`IVA (${(IVA_RATE * 100).toFixed(0)}%)`}
              value={`$${totalIva.toFixed(2)}`}
            />
            <div className="flex justify-between items-center">
              <label
                className="flex items-center gap-2 cursor-pointer text-[13px]"
                style={{ color: TOKENS.slate700 }}
              >
                <input
                  type="checkbox"
                  checked={applyIgtf}
                  onChange={(e) => setApplyIgtf(e.target.checked)}
                  style={{ accentColor: TOKENS.orange }}
                />
                IGTF ({(IGTF_RATE * 100).toFixed(0)}%)
              </label>
              <span className="pm-tnum" style={{ color: TOKENS.charcoal }}>
                ${totalIgtf.toFixed(2)}
              </span>
            </div>
            <div
              className="pt-2 mt-1 flex justify-between items-center font-bold text-[15px]"
              style={{
                borderTop: `1px solid ${TOKENS.slate200}`,
                color: TOKENS.charcoal,
              }}
            >
              <span>Total USD</span>
              <span className="pm-tnum">${grandTotal.toFixed(2)}</span>
            </div>
            {exchangeRate > 0 ? (
              <div
                className="flex justify-between pt-1 text-[11px] pm-tnum"
                style={{ color: TOKENS.slate500 }}
              >
                <span>Tasa BCV: Bs. {exchangeRate.toFixed(2)}</span>
                <span>≈ Bs. {(grandTotal * exchangeRate).toFixed(2)}</span>
              </div>
            ) : (
              <div
                className="flex items-center gap-1 pt-1 text-[11px]"
                style={{ color: TOKENS.red }}
              >
                <AlertCircle className="h-3 w-3" />
                Sin tasa de cambio. Sincroniza desde Tasas Cambiarias.
              </div>
            )}
          </div>

          <PMBtnPrimary
            onClick={handleFinalizeSale}
            disabled={cart.length === 0 || isProcessing}
            className="w-full h-11 text-[14px]"
          >
            {isProcessing ? 'Procesando…' : 'Finalizar Venta'}
          </PMBtnPrimary>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: TOKENS.slate500 }}>{label}:</span>
      <span className="pm-tnum" style={{ color: TOKENS.charcoal }}>
        {value}
      </span>
    </div>
  );
}
