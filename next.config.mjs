import createNextPwa from '@ducanh2912/next-pwa';

const withPWA = createNextPwa({
  dest: 'public', // El Service Worker se genera en la carpeta public
  register: true, // Registra el SW automáticamente
  skipWaiting: true, // Fuerza al nuevo SW a activarse inmediatamente
  disable: process.env.NODE_ENV === 'development', // Desactiva PWA en desarrollo
  fallbacks: {
    // Cuando está offline, si pide una página que no está en caché, muestra esto.
    document: '/_offline', // Necesitas crear una página `app/_offline/page.tsx`
  }
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuración de Next.js
  turbopack: {}, // Silencia el error de Turbopack/Webpack
};

export default withPWA(nextConfig);