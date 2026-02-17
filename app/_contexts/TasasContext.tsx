"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { TasasSincronizadas } from '@/app/_services/dolarapi';
import { dolarApiService } from '@/app/_services/dolarapi';

interface TasasContextType {
  tasas: TasasSincronizadas | null;
  actualizarTasas: (tasas: TasasSincronizadas) => void;
  recargarTasas: () => void;
  estaCargando: boolean;
}

const TasasContext = createContext<TasasContextType | undefined>(undefined);

export function TasasProvider({ children }: { children: React.ReactNode }) {
  const [tasas, setTasas] = useState<TasasSincronizadas | null>(null);
  const [estaCargando, setEstaCargando] = useState(true);

  // Cargar tasas al inicio
  useEffect(() => {
    recargarTasas();
  }, []);

  const actualizarTasas = useCallback((nuevasTasas: TasasSincronizadas) => {
    setTasas(nuevasTasas);
    // Guardar en localStorage para persistencia
    dolarApiService.guardarEnLocalStorage(nuevasTasas);
  }, []);

  const recargarTasas = useCallback(() => {
    setEstaCargando(true);
    const tasasGuardadas = dolarApiService.obtenerDeLocalStorage();
    if (tasasGuardadas) {
      setTasas(tasasGuardadas);
    }
    setEstaCargando(false);
  }, []);

  return (
    <TasasContext.Provider
      value={{
        tasas,
        actualizarTasas,
        recargarTasas,
        estaCargando,
      }}
    >
      {children}
    </TasasContext.Provider>
  );
}

export function useTasas() {
  const context = useContext(TasasContext);
  if (context === undefined) {
    throw new Error('useTasas debe usarse dentro de un TasasProvider');
  }
  return context;
}

export default TasasProvider;
