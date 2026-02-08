// app/_lib/printing.ts

import { Sale, Customer, Product } from "../_db/db";

interface CartItem extends Product {
  quantity: number;
}

interface FullSaleInfo {
    sale: Sale;
    items: CartItem[];
    customer?: Customer;
}

/**
 * Simulates printing an invoice to a fiscal printer.
 * In a real-world scenario, this function would interface with a native client
 * or a hardware-specific API to send commands to a fiscal printer.
 * 
 * @param {FullSaleInfo} saleInfo - The complete sale information.
 */
export function printFiscalInvoice(saleInfo: FullSaleInfo) {
    console.log("--- SIMULATING FISCAL INVOICE PRINTING ---");
    console.log("==========================================");
    console.log(`            FACTURA DE VENTA`);
    console.log("==========================================");
    console.log(`Fecha: ${new Date(saleInfo.sale.date).toLocaleString()}`);
    console.log(`Factura ID: #${saleInfo.sale.id}`);
    console.log("------------------------------------------");
    if (saleInfo.customer) {
        console.log(`Cliente: ${saleInfo.customer.name}`);
        if(saleInfo.customer.email) console.log(`Email: ${saleInfo.customer.email}`);
        console.log("------------------------------------------");
    }
    
    console.log("CANT. | DESCRIPCIÓN                  | P. UNIT. | SUBTOTAL");
    console.log("-----------------------------------------------------------");
    
    saleInfo.items.forEach(item => {
        const name = item.name.padEnd(28).substring(0, 28);
        const qty = item.quantity.toString().padStart(4);
        const unit = (`$${item.priceUsd.toFixed(2)}`).padStart(9);
        const sub = (`$${(item.priceUsd * item.quantity).toFixed(2)}`).padStart(9);
        console.log(`${qty} | ${name} | ${unit} | ${sub}`);
    });
    
    console.log("==========================================");
    console.log(`SUBTOTAL: $${saleInfo.sale.subtotalUsd.toFixed(2)}`);
    console.log(`IVA (16%): $${saleInfo.sale.ivaAmountUsd.toFixed(2)}`);
    console.log(`TOTAL: $${saleInfo.sale.totalAmountUsd.toFixed(2)}`);
    console.log("==========================================");
    console.log("--- END OF SIMULATED PRINT ---");
}
