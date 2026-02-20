"use client";

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, GastoFijo, ConfiguracionMeta, Product, Sale } from '@/app/_db/db';

// ============================================================================
// INTERFACES DE RESULTADOS
// ============================================================================

export interface CalculosPuntoEquilibrio {
  puntoEquilibrio: number;           // Ventas necesarias para cubrir costos
  metaMensual: number;               // Ventas necesarias para cubrir costos + utilidad
  metaDiaria: number;                // Meta mensual / días laborales
  costosFijosTotales: number;        // Suma de todos los gastos fijos activos
  margenPromedio: number;            // Promedio histórico de margen de productos
}

export interface ProgresoMeta {
  ventasMesActual: number;           // Total vendido este mes
  porcentajeCumplimiento: number;    // % de la meta mensual alcanzado
  ventasHoy: number;                 // Ventas del día de hoy
  metaDiariaCumplida: boolean;       // Si se alcanzó la meta diaria
  faltanteParaMeta: number;          // Cuánto falta para alcanzar meta mensual
  diasRestantes: number;             // Días laborales restantes
  proyeccionFinal: number;           // Proyección de ventas al final del mes
}

export interface EstadoMeta {
  meta: ConfiguracionMeta | null;
  calculos: CalculosPuntoEquilibrio;
  progreso: ProgresoMeta;
  gastosFijos: GastoFijo[];
  ventasPorDia: { fecha: Date; total: number }[];
}

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

export function usePuntoEquilibrio(mes?: number, año?: number) {
  // Fecha actual o proporcionada
  const fechaReferencia = useMemo(() => {
    const now = new Date();
    return {
      mes: mes || now.getMonth() + 1,
      año: año || now.getFullYear(),
    };
  }, [mes, año]);

  // Estados
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Obtener datos de la BD
  const gastosFijos = useLiveQuery(
    () => db.gastosFijos
      .where('activo')
      .equals(1)
      .toArray(),
    []
  );

  const configuracionMeta = useLiveQuery(
    () => db.configuracionMetas
      .where({ mes: fechaReferencia.mes, año: fechaReferencia.año })
      .first(),
    [fechaReferencia.mes, fechaReferencia.año]
  );

  const ventasMes = useLiveQuery(
    () => {
      const inicioMes = new Date(fechaReferencia.año, fechaReferencia.mes - 1, 1);
      const finMes = new Date(fechaReferencia.año, fechaReferencia.mes, 0);
      
      return db.sales
        .where('date')
        .between(inicioMes, finMes)
        .toArray();
    },
    [fechaReferencia.mes, fechaReferencia.año]
  );

  const productos = useLiveQuery(
    () => db.products.toArray(),
    []
  );

  // ============================================================================
  // CÁLCULOS
  // ============================================================================

  /**
   * Calcula el margen promedio histórico de todos los productos
   */
  const calcularMargenPromedio = useCallback((): number => {
    if (!productos || productos.length === 0) return 30; // Default 30%
    
    const margenes = productos
      .filter(p => p.costUsd && p.costUsd > 0 && p.priceUsd > 0)
      .map(p => {
        const costo = p.costUsd || 0;
        const margen = ((p.priceUsd - costo) / p.priceUsd) * 100;
        return margen;
      });
    
    if (margenes.length === 0) return 30;
    
    const promedio = margenes.reduce((a, b) => a + b, 0) / margenes.length;
    return Math.max(0, promedio);
  }, [productos]);

  /**
   * Calcula el punto de equilibrio
   * Fórmula: Costos Fijos / (Margen / 100)
   */
  const calcularPuntoEquilibrio = useCallback((
    costosFijos: number,
    margenPromedio: number
  ): number => {
    if (margenPromedio <= 0) return 0;
    return costosFijos / (margenPromedio / 100);
  }, []);

  /**
   * Calcula la meta mensual
   * Fórmula: (Costos Fijos + Utilidad Deseada) / (Margen / 100)
   */
  const calcularMetaMensual = useCallback((
    costosFijos: number,
    margenPromedio: number,
    utilidadDeseada: number
  ): number => {
    if (margenPromedio <= 0) return 0;
    return (costosFijos + utilidadDeseada) / (margenPromedio / 100);
  }, []);

  /**
   * Calcula la meta diaria
   * Fórmula: Meta Mensual / Días Laborales
   */
  const calcularMetaDiaria = useCallback((
    metaMensual: number,
    diasLaborales: number
  ): number => {
    if (diasLaborales <= 0) return 0;
    return metaMensual / diasLaborales;
  }, []);

  /**
   * Calcula ventas del día actual
   */
  const calcularVentasHoy = useCallback((ventas: Sale[] | undefined): number => {
    if (!ventas) return 0;
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    return ventas
      .filter(v => {
        const fechaVenta = new Date(v.date);
        fechaVenta.setHours(0, 0, 0, 0);
        return fechaVenta.getTime() === hoy.getTime();
      })
      .reduce((sum, v) => sum + v.totalAmountUsd, 0);
  }, []);

  /**
   * Calcula días laborales transcurridos y restantes
   */
  const calcularDiasLaborales = useCallback((
    diasLaboralesTotales: number
  ): { transcurridos: number; restantes: number } => {
    const hoy = new Date();
    const inicioMes = new Date(fechaReferencia.año, fechaReferencia.mes - 1, 1);
    
    // Calcular días transcurridos (solo días laborales)
    let transcurridos = 0;
    const fechaActual = new Date(inicioMes);
    
    while (fechaActual <= hoy) {
      const diaSemana = fechaActual.getDay();
      if (diaSemana !== 0 && diaSemana !== 6) { // No domingo ni sábado
        transcurridos++;
      }
      fechaActual.setDate(fechaActual.getDate() + 1);
    }
    
    return {
      transcurridos: Math.min(transcurridos, diasLaboralesTotales),
      restantes: Math.max(0, diasLaboralesTotales - transcurridos),
    };
  }, [fechaReferencia]);

  // ============================================================================
  // VALORES CALCULADOS
  // ============================================================================

  const estado = useMemo((): EstadoMeta => {
    setCargando(true);
    
    try {
      // 1. Calcular costos fijos totales
      const costosFijosTotales = gastosFijos?.reduce(
        (sum, g) => sum + g.montoUSD,
        0
      ) || 0;

      // 2. Calcular margen promedio
      const margenPromedio = configuracionMeta?.margenPromedioEsperado 
        || calcularMargenPromedio();

      // 3. Calcular ventas totales del mes
      const ventasMesActual = ventasMes?.reduce(
        (sum, v) => sum + v.totalAmountUsd,
        0
      ) || 0;

      // 4. Obtener utilidad deseada
      const utilidadDeseada = configuracionMeta?.utilidadDeseadaUSD || 0;

      // 5. Obtener días laborales
      const diasLaborales = configuracionMeta?.diasLaborales || 26;

      // 6. Realizar cálculos principales
      const puntoEquilibrio = calcularPuntoEquilibrio(costosFijosTotales, margenPromedio);
      const metaMensual = calcularMetaMensual(
        costosFijosTotales,
        margenPromedio,
        utilidadDeseada
      );
      const metaDiaria = calcularMetaDiaria(metaMensual, diasLaborales);

      // 7. Calcular progreso
      const porcentajeCumplimiento = metaMensual > 0
        ? (ventasMesActual / metaMensual) * 100
        : 0;

      const ventasHoy = calcularVentasHoy(ventasMes);
      const metaDiariaCumplida = ventasHoy >= metaDiaria;
      const faltanteParaMeta = Math.max(0, metaMensual - ventasMesActual);

      const diasInfo = calcularDiasLaborales(diasLaborales);

      // 8. Calcular proyección
      const proyeccionFinal = diasInfo.transcurridos > 0
        ? (ventasMesActual / diasInfo.transcurridos) * diasLaborales
        : 0;

      // 9. Preparar ventas por día para gráfico
      const ventasPorDia = ventasMes?.reduce((acc, venta) => {
        const fecha = new Date(venta.date);
        fecha.setHours(0, 0, 0, 0);
        const fechaKey = fecha.toISOString();
        
        const existente = acc.find(item => 
          item.fecha.toISOString() === fechaKey
        );
        
        if (existente) {
          existente.total += venta.totalAmountUsd;
        } else {
          acc.push({ fecha, total: venta.totalAmountUsd });
        }
        
        return acc;
      }, [] as { fecha: Date; total: number }[])
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime()) || [];

      setCargando(false);
      setError(null);

      return {
        meta: configuracionMeta || null,
        calculos: {
          puntoEquilibrio,
          metaMensual,
          metaDiaria,
          costosFijosTotales,
          margenPromedio,
        },
        progreso: {
          ventasMesActual,
          porcentajeCumplimiento,
          ventasHoy,
          metaDiariaCumplida,
          faltanteParaMeta,
          diasRestantes: diasInfo.restantes,
          proyeccionFinal,
        },
        gastosFijos: gastosFijos || [],
        ventasPorDia,
      };
    } catch (err: any) {
      setError(err.message || 'Error al calcular métricas');
      setCargando(false);
      
      return {
        meta: null,
        calculos: {
          puntoEquilibrio: 0,
          metaMensual: 0,
          metaDiaria: 0,
          costosFijosTotales: 0,
          margenPromedio: 0,
        },
        progreso: {
          ventasMesActual: 0,
          porcentajeCumplimiento: 0,
          ventasHoy: 0,
          metaDiariaCumplida: false,
          faltanteParaMeta: 0,
          diasRestantes: 0,
          proyeccionFinal: 0,
        },
        gastosFijos: [],
        ventasPorDia: [],
      };
    }
  }, [
    gastosFijos,
    configuracionMeta,
    ventasMes,
    productos,
    calcularMargenPromedio,
    calcularPuntoEquilibrio,
    calcularMetaMensual,
    calcularMetaDiaria,
    calcularVentasHoy,
    calcularDiasLaborales,
  ]);

  // ============================================================================
  // FUNCIONES CRUD
  // ============================================================================

  const guardarGastoFijo = useCallback(async (gasto: Omit<GastoFijo, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> => {
    const now = new Date();
    const id = await db.gastosFijos.add({
      ...gasto,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }, []);

  const actualizarGastoFijo = useCallback(async (id: number, gasto: Partial<GastoFijo>): Promise<void> => {
    await db.gastosFijos.update(id, {
      ...gasto,
      updatedAt: new Date(),
    });
  }, []);

  const eliminarGastoFijo = useCallback(async (id: number): Promise<void> => {
    await db.gastosFijos.delete(id);
  }, []);

  const guardarConfiguracionMeta = useCallback(async (
    utilidadDeseadaUSD: number,
    margenPromedioEsperado: number,
    diasLaborales: number = 26
  ): Promise<number> => {
    const now = new Date();
    
    // Buscar si ya existe configuración para este mes
    const existente = await db.configuracionMetas
      .where({ mes: fechaReferencia.mes, año: fechaReferencia.año })
      .first();
    
    // Calcular valores automáticos
    const costosFijosTotales = gastosFijos?.reduce((sum, g) => sum + g.montoUSD, 0) || 0;
    const margenPromedio = margenPromedioEsperado || calcularMargenPromedio();
    
    const puntoEquilibrioCalculado = calcularPuntoEquilibrio(costosFijosTotales, margenPromedio);
    const metaMensualCalculada = calcularMetaMensual(
      costosFijosTotales,
      margenPromedio,
      utilidadDeseadaUSD
    );
    const metaDiariaCalculada = calcularMetaDiaria(metaMensualCalculada, diasLaborales);
    
    if (existente?.id) {
      // Actualizar
      await db.configuracionMetas.update(existente.id, {
        utilidadDeseadaUSD,
        margenPromedioEsperado: margenPromedio,
        diasLaborales,
        puntoEquilibrioCalculado,
        metaMensualCalculada,
        metaDiariaCalculada,
        updatedAt: now,
      });
      return existente.id;
    } else {
      // Crear nueva
      const id = await db.configuracionMetas.add({
        mes: fechaReferencia.mes,
        año: fechaReferencia.año,
        utilidadDeseadaUSD,
        margenPromedioEsperado: margenPromedio,
        diasLaborales,
        puntoEquilibrioCalculado,
        metaMensualCalculada,
        metaDiariaCalculada,
        createdAt: now,
        updatedAt: now,
      });
      return id;
    }
  }, [fechaReferencia, gastosFijos, calcularMargenPromedio, calcularPuntoEquilibrio, calcularMetaMensual, calcularMetaDiaria]);

  // ============================================================================
  // HELPERS
  // ============================================================================

  const formatearUSD = useCallback((monto: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(monto);
  }, []);

  const formatearPorcentaje = useCallback((valor: number): string => {
    return `${valor.toFixed(1)}%`;
  }, []);

  return {
    estado,
    cargando,
    error,
    fechaReferencia,
    
    // Funciones CRUD
    guardarGastoFijo,
    actualizarGastoFijo,
    eliminarGastoFijo,
    guardarConfiguracionMeta,
    
    // Helpers
    formatearUSD,
    formatearPorcentaje,
  };
}

export default usePuntoEquilibrio;
