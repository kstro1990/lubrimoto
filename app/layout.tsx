import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import ClientProviders from './_components/ClientProviders';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LubriMotos ERP',
  description: 'Sistema ERP para gestión de lubricantes y repuestos de motos.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
