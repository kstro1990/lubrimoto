"use client";

import { useState, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ConfiguracionCambiaria, HistorialTasa, CalculoPrecioVenezuela } from '@/app/_db/db';

// ============================================================================
// INTERFACES
// ============================================================================

export interface CalculoInput {
  costoUSD: number;
  margenPorcentaje: number;
  tasaBCV: number;
  tasaParalelo: number;
}

export interface CalculoOutput {
  // Entradas
  costoUSD: number;
  margenPorcentaje: number;
  tasaBCV: number;
  tasaParalelo: number;
  
  // Cálculos base
  precioBaseUSD: number;           // Costo / (1 - Margen)
  factorProteccion: number;        // tasaParalelo / tasaBCV
  brechaCambiaria: number;         // % de diferencia entre tasas
  
  // Precio Idea (ajuste por brecha cambiaria)
  precioIdea: number;              // costoUSD * factorProteccion
  precioIdeaMenorAlCosto: boolean; // Alerta si precioIdea < costoUSD
  
  // Precios finales
  precioVentaUSD: number;          // Igual al precio base
  precioVentaBsProtegido: number;  // precioBaseUSD * factor * tasaBCV
  precioVentaBsSinProteccion: number; // precioBaseUSD * tasaBCV
  
  // Análisis de rentabilidad
  gananciaEsperadaUSD: number;     // Lo que esperarías ganar
  gananciaRealUSD: number;         // Lo que realmente ganas
  gananciaRealPorcentaje: number;  // Margen real efectivo
  perdidaPorBrechaUSD: number;     // Pérdida en USD
  perdidaPorBrechaPorcentaje: number; // Pérdida como %
  
  // Alertas
  esGananciaBaja: boolean;         // < 5%
  esPerdida: boolean;              // Ganancia negativa
}

export interface EstadisticasCalculo {
  promedioGananciaReal: number;
  totalProductos: number;
  productosConPerdida: number;
  productosGananciaBaja: number;
  perdidaTotalPorBrecha: number;
}

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

export function useFinanzasVZLA() {
  // Estados locales
  const [tasaBCV, setTasaBCV] = useState<number>(36.50);
  const [tasaParalelo, setTasaParalelo] = useState<number>(38.20);
  const [margenGlobal, setMargenGlobal] = useState<number>(30);
  
  // Obtener configuración activa de la BD
  const configActiva = useLiveQuery(
    () => db.configuracionCambiaria
      .where('esActiva')
      .equals(1)
      .first(),
    []
  );
  
  // Obtener historial de tasas
  const historialTasas = useLiveQuery(
    () => db.historialTasas
      .orderBy('fecha')
      .reverse()
      .limit(100)
      .toArray(),
    []
  );
  
  // ============================================================================
  // FUNCIONES DE CÁLCULO
  // ============================================================================
  
  /**
   * Calcula el precio base con margen sobre venta
   * Fórmula: Precio = Costo / (1 - Margen)
   */
  const calcularPrecioBase = useCallback((costo: number, margen: number): number => {
    if (margen >= 100) return Infinity;
    if (margen <= 0) return costo;
    return costo / (1 - (margen / 100));
  }, []);
  
  /**
   * Calcula el factor de protección cambiaria
   * Fórmula: Factor = TasaParalelo / TasaBCV
   */
  const calcularFactorProteccion = useCallback((tasaBCV: number, tasaParalelo: number): number => {
    if (tasaBCV === 0) return 1;
    return tasaParalelo / tasaBCV;
  }, []);
  
  /**
   * Calcula la brecha cambiaria
   * Fórmula: Brecha = (Paralelo - BCV) / BCV * 100
   */
  const calcularBrecha = useCallback((tasaBCV: number, tasaParalelo: number): number => {
    if (tasaBCV === 0) return 0;
    return ((tasaParalelo - tasaBCV) / tasaBCV) * 100;
  }, []);
  
  /**
   * Realiza el cálculo completo de precios y rentabilidad
   */
  const calcularPrecio = useCallback((input: CalculoInput): CalculoOutput => {
    const { costoUSD, margenPorcentaje, tasaBCV, tasaParalelo } = input;
    
    // Cálculos base
    const precioBaseUSD = calcularPrecioBase(costoUSD, margenPorcentaje);
    const factorProteccion = calcularFactorProteccion(tasaBCV, tasaParalelo);
    const brechaCambiaria = calcularBrecha(tasaBCV, tasaParalelo);
    
    // Precio Idea (ajuste por brecha cambiaria)
    // Fórmula: Costo × (Tasa Paralelo / Tasa BCV)
    const precioIdea = costoUSD * factorProteccion;
    const precioIdeaMenorAlCosto = precioIdea < costoUSD;
    
    // Precios de venta
    const precioVentaUSD = precioBaseUSD;
    const precioVentaBsProtegido = precioBaseUSD * factorProteccion * tasaBCV;
    const precioVentaBsSinProteccion = precioBaseUSD * tasaBCV;
    
    // Análisis de rentabilidad
    const gananciaEsperadaUSD = precioVentaUSD - costoUSD;
    
    // Si vendes a tasa BCV sin protección y luego cambias a paralelo
    const ingresoUSDReal = precioVentaBsSinProteccion / tasaParalelo;
    const gananciaRealUSD = ingresoUSDReal - costoUSD;
    const gananciaRealPorcentaje = (gananciaRealUSD / precioVentaUSD) * 100;
    
    // Pérdida por la brecha
    const perdidaPorBrechaUSD = gananciaEsperadaUSD - gananciaRealUSD;
    const perdidaPorBrechaPorcentaje = gananciaEsperadaUSD > 0 
      ? (perdidaPorBrechaUSD / gananciaEsperadaUSD) * 100 
      : 0;
    
    // Alertas
    const esGananciaBaja = gananciaRealPorcentaje < 5 && gananciaRealPorcentaje >= 0;
    const esPerdida = gananciaRealUSD < 0;
    
    return {
      costoUSD,
      margenPorcentaje,
      tasaBCV,
      tasaParalelo,
      precioBaseUSD,
      factorProteccion,
      brechaCambiaria,
      precioIdea,
      precioIdeaMenorAlCosto,
      precioVentaUSD,
      precioVentaBsProtegido,
      precioVentaBsSinProteccion,
      gananciaEsperadaUSD,
      gananciaRealUSD,
      gananciaRealPorcentaje,
      perdidaPorBrechaUSD,
      perdidaPorBrechaPorcentaje,
      esGananciaBaja,
      esPerdida,
    };
  }, [calcularPrecioBase, calcularFactorProteccion, calcularBrecha]);
  
  /**
   * Calcula múltiples productos y devuelve estadísticas
   */
  const calcularMultiplesProductos = useCallback((
    costosUSD: number[],
    margen: number = margenGlobal
  ): { calculos: CalculoOutput[]; estadisticas: EstadisticasCalculo } => {
    const calculos = costosUSD.map(costo => 
      calcularPrecio({
        costoUSD: costo,
        margenPorcentaje: margen,
        tasaBCV,
        tasaParalelo,
      })
    );
    
    const gananciasReales = calculos.map(c => c.gananciaRealUSD);
    const promedioGananciaReal = gananciasReales.reduce((a, b) => a + b, 0) / gananciasReales.length;
    
    const estadisticas: EstadisticasCalculo = {
      promedioGananciaReal,
      totalProductos: calculos.length,
      productosConPerdida: calculos.filter(c => c.esPerdida).length,
      productosGananciaBaja: calculos.filter(c => c.esGananciaBaja).length,
      perdidaTotalPorBrecha: calculos.reduce((sum, c) => sum + c.perdidaPorBrechaUSD, 0),
    };
    
    return { calculos, estadisticas };
  }, [calcularPrecio, margenGlobal, tasaBCV, tasaParalelo]);
  
  // ============================================================================
  // FUNCIONES DE FORMATEO
  // ============================================================================
  
  /**
   * Formatea montos en Bolívares (VES)
   */
  const formatearBs = useCallback((monto: number): string => {
    if (!isFinite(monto) || isNaN(monto)) return 'Bs. ---';
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'VES',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(monto);
  }, []);
  
  /**
   * Formatea montos en USD
   */
  const formatearUSD = useCallback((monto: number): string => {
    if (!isFinite(monto) || isNaN(monto)) return '$ ---';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(monto);
  }, []);
  
  /**
   * Formatea porcentajes
   */
  const formatearPorcentaje = useCallback((valor: number, decimales: number = 1): string => {
    if (!isFinite(valor) || isNaN(valor)) return '---%';
    return `${valor.toFixed(decimales)}%`;
  }, []);
  
  /**
   * Formatea número con separadores de miles
   */
  const formatearNumero = useCallback((valor: number, decimales: number = 2): string => {
    if (!isFinite(valor) || isNaN(valor)) return '---';
    return new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    }).format(valor);
  }, []);
  
  // ============================================================================
  // FUNCIONES DE BASE DE DATOS
  // ============================================================================
  
  /**
   * Guarda una nueva configuración cambiaria
   */
  const guardarConfiguracion = useCallback(async (config: Omit<ConfiguracionCambiaria, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> => {
    const now = new Date();
    
    // Desactivar configuración anterior
    await db.configuracionCambiaria
      .where('esActiva')
      .equals(1)
      .modify({ esActiva: false, updatedAt: now });
    
    // Crear nueva configuración
    const id = await db.configuracionCambiaria.add({
      ...config,
      esActiva: true,
      syncStatus: 'pending' as any,
      createdAt: now,
      updatedAt: now,
    });
    
    return id;
  }, []);
  
  /**
   * Registra una tasa en el historial
   */
  const registrarTasaHistorial = useCallback(async (
    tasaBCV: number,
    tasaParalelo: number,
    fuente?: string
  ): Promise<number> => {
    const now = new Date();
    const brecha = calcularBrecha(tasaBCV, tasaParalelo);
    
    const id = await db.historialTasas.add({
      tasaBCV,
      tasaParalelo,
      brecha,
      fecha: now,
      hora: now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
      fuente,
      createdAt: now,
    });
    
    return id;
  }, [calcularBrecha]);
  
  /**
   * Guarda un cálculo de precio
   */
  const guardarCalculo = useCallback(async (
    productId: number,
    configId: number,
    calculo: CalculoOutput
  ): Promise<number> => {
    const now = new Date();
    
    const id = await db.calculosPrecios.add({
      productId,
      configId,
      costoUSD: calculo.costoUSD,
      margenPorcentaje: calculo.margenPorcentaje,
      tasaBCV: calculo.tasaBCV,
      tasaParalelo: calculo.tasaParalelo,
      precioBaseUSD: calculo.precioBaseUSD,
      factorProteccion: calculo.factorProteccion,
      brechaCambiaria: calculo.brechaCambiaria,
      precioVentaUSD: calculo.precioVentaUSD,
      precioVentaBsProtegido: calculo.precioVentaBsProtegido,
      precioVentaBsSinProteccion: calculo.precioVentaBsSinProteccion,
      gananciaEsperadaUSD: calculo.gananciaEsperadaUSD,
      gananciaRealUSD: calculo.gananciaRealUSD,
      gananciaRealPorcentaje: calculo.gananciaRealPorcentaje,
      perdidaPorBrechaUSD: calculo.perdidaPorBrechaUSD,
      perdidaPorBrechaPorcentaje: calculo.perdidaPorBrechaPorcentaje,
      esGananciaBaja: calculo.esGananciaBaja,
      esPerdida: calculo.esPerdida,
      fechaCalculo: now,
      createdAt: now,
    });
    
    return id;
  }, []);
  
  // ============================================================================
  // VALORES MEMOIZADOS
  // ============================================================================
  
  const factorProteccionActual = useMemo(() => 
    calcularFactorProteccion(tasaBCV, tasaParalelo),
    [tasaBCV, tasaParalelo, calcularFactorProteccion]
  );
  
  const brechaActual = useMemo(() => 
    calcularBrecha(tasaBCV, tasaParalelo),
    [tasaBCV, tasaParalelo, calcularBrecha]
  );
  
  // ============================================================================
  // RETURN
  // ============================================================================
  
  return {
    // Estados
    tasaBCV,
    setTasaBCV,
    tasaParalelo,
    setTasaParalelo,
    margenGlobal,
    setMargenGlobal,
    
    // Datos de BD
    configActiva,
    historialTasas,
    
    // Cálculos memoizados
    factorProteccionActual,
    brechaActual,
    
    // Funciones de cálculo
    calcularPrecio,
    calcularMultiplesProductos,
    calcularPrecioBase,
    calcularFactorProteccion,
    calcularBrecha,
    
    // Funciones de formateo
    formatearBs,
    formatearUSD,
    formatearPorcentaje,
    formatearNumero,
    
    // Funciones de BD
    guardarConfiguracion,
    registrarTasaHistorial,
    guardarCalculo,
  };
}

export default useFinanzasVZLA;
