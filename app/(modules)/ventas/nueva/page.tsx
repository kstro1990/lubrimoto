import { Receipt } from 'lucide-react';
import SaleTerminal from './_components/SaleTerminal';
import { TOKENS } from '@/app/_components/_pmTheme';

export default function NuevaVentaPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 py-6">
        <div className="mb-5">
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
                Nueva Venta · Facturación
              </h1>
              <p className="text-[13px]" style={{ color: TOKENS.slate500 }}>
                Selecciona productos, configura el pago y emite la factura.
              </p>
            </div>
          </div>
        </div>
        <SaleTerminal />
      </div>
    </div>
  );
}
