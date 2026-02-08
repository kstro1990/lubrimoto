import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// WARNING: This is a placeholder. In a real-world scenario, you would
// use a transactional email service like Resend, SendGrid, or Postmark.
// You would also need to configure Supabase with the necessary API keys as secrets.
//
// Example with Resend (if you had `resend` configured):
//
// import { Resend } from 'resend';
// const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
//
// await resend.emails.send({
//   from: 'ventas@lubrimotos.com',
//   to: customer.email,
//   subject: `Factura de tu compra #${sale.id}`,
//   html: emailHtml,
// });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { sale, items, customer } = await req.json()

    if (!customer || !customer.email) {
      return new Response(JSON.stringify({ message: "No customer email provided." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Not an error, just an expected condition
      });
    }

    // Simulate creating the HTML for the email
    const itemsHtml = items.map((item: any) => `
      <tr>
        <td>${item.name}</td>
        <td>${item.quantity}</td>
        <td>$${(item.priceUsd || item.price || 0).toFixed(2)}</td>
        <td>$${((item.priceUsd || item.price || 0) * item.quantity).toFixed(2)}</td>
      </tr>
    `).join('');

    const totalAmount = sale.totalAmountUsd || sale.total || 0;
    const subtotal = sale.subtotalUsd || 0;
    const iva = sale.ivaAmountUsd || 0;

    const emailHtml = `
      <h1>Gracias por tu compra, ${customer.name}!</h1>
      <p>Aquí está el resumen de tu factura #${sale.id}:</p>
      <table border="1" cellpadding="5" cellspacing="0">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Cantidad</th>
            <th>Precio Unit.</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      <p>Subtotal: $${subtotal.toFixed(2)}</p>
      <p>IVA (16%): $${iva.toFixed(2)}</p>
      <h2>Total: $${totalAmount.toFixed(2)}</h2>
      <p>LubriMotos ERP</p>
    `;
    
    console.log("--- SIMULATING INVOICE EMAIL ---");
    console.log(`Recipient: ${customer.email}`);
    console.log(`Subject: Factura de tu compra #${sale.id}`);
    console.log("--- Email Body (HTML) ---");
    console.log(emailHtml);
    console.log("--- END OF SIMULATED EMAIL ---");


    return new Response(JSON.stringify({ message: "Email simulation successful." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
