// Script de diagnóstico para sincronización
// Ejecutar en consola del navegador o como test

import { db, SyncStatus } from './app/_db/db.js';
import { supabase } from './app/_lib/supabase.js';

async function testSync() {
  console.log('🧪 INICIANDO TEST DE SINCRONIZACIÓN\n');
  
  // 1. Verificar base de datos local
  console.log('1️⃣ Estado de IndexedDB:');
  try {
    const productCount = await db.products.count();
    const saleCount = await db.sales.count();
    console.log(`   ✅ Productos locales: ${productCount}`);
    console.log(`   ✅ Ventas locales: ${saleCount}`);
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    return;
  }
  
  // 2. Verificar productos pendientes
  console.log('\n2️⃣ Productos pendientes de sync:');
  try {
    const pending = await db.products
      .where('syncStatus')
      .equals(SyncStatus.PENDING)
      .toArray();
    console.log(`   📦 ${pending.length} productos pendientes`);
    if (pending.length > 0) {
      pending.forEach(p => console.log(`      - ${p.sku}: ${p.name}`));
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }
  
  // 3. Intentar descargar un producto de Supabase
  console.log('\n3️⃣ Descargando producto de prueba:');
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .limit(1);
      
    if (error) throw error;
    
    if (data && data.length > 0) {
      const product = data[0];
      console.log(`   ✅ Producto recibido: ${product.sku} - ${product.name}`);
      
      // 4. Intentar guardar en IndexedDB
      console.log('\n4️⃣ Guardando en IndexedDB:');
      try {
        const localProduct = await db.products.where('sku').equals(product.sku).first();
        
        if (localProduct) {
          console.log(`   📝 Actualizando producto existente (ID: ${localProduct.id})`);
          await db.products.update(localProduct.id, {
            name: product.name,
            priceUsd: product.price_usd,
            stockQuantity: product.stock_quantity,
            updatedAt: new Date()
          });
        } else {
          console.log(`   ➕ Creando nuevo producto`);
          await db.products.add({
            sku: product.sku,
            name: product.name,
            priceUsd: product.price_usd,
            stockQuantity: product.stock_quantity,
            syncStatus: SyncStatus.SYNCED,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
        console.log('   ✅ Guardado exitoso');
      } catch (dbError) {
        console.log(`   ❌ Error al guardar: ${dbError.message}`);
        console.log(`   Stack: ${dbError.stack}`);
      }
    } else {
      console.log('   ⚠️ No hay productos en Supabase');
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }
  
  // 5. Verificar estado final
  console.log('\n5️⃣ Estado final:');
  const finalCount = await db.products.count();
  console.log(`   📊 Total productos locales: ${finalCount}`);
  
  console.log('\n✅ Test completado');
}

// Ejecutar si se corre directamente
if (typeof window !== 'undefined') {
  window.testSync = testSync;
  console.log('💡 Ejecuta testSync() en la consola para probar');
}

export { testSync };
