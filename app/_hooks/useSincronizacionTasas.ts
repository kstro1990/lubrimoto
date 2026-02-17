"use client";

import { useState, useCallback, useEffect } from 'react';
import { dolarApiService, TasasSincronizadas, ComparacionTasas } from '@/app/_services/dolarapi';
import { db } from '@/app/_db/db';

export type SincronizacionEstado = 'idle' | 'loading' | 'success' | 'error';

export interface SincronizacionResultado {
  tasas: TasasSincronizadas;
  comparacion: ComparacionTasas;
  desdeCache: boolean;
  mensaje?: string;
}

export function useSincronizacionTasas() {
  const [estado, setEstado] = useState<SincronizacionEstado>('idle');
  const [resultado, setResultado] = useState<SincronizacionResultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState<Date | null>(null);
  const [progreso, setProgreso] = useState<number>(0);

  // Cargar última sincronización al montar
  useEffect(() => {
    const fecha = dolarApiService.obtenerUltimaSincronizacion();
    setUltimaSincronizacion(fecha);
  }, []);

  /**
   * Sincroniza las tasas con DolarApi
   */
  const sincronizar = useCallback(async (): Promise<SincronizacionResultado> => {
    setEstado('loading');
    setError(null);
    setProgreso(10);

    try {
      // Obtener tasas anteriores para comparación
      const tasasAnteriores = dolarApiService.obtenerDeLocalStorage();
      
      setProgreso(30);

      // Intentar sincronizar (con fallback a cache)
      const { tasas, desdeCache, mensaje } = await dolarApiService.sincronizarConFallback();
      
      setProgreso(60);

      // Comparar con tasas anteriores
      const comparacion = dolarApiService.compararTasas(tasas, tasasAnteriores);
      
      setProgreso(80);

      // Guardar en IndexedDB (historial)
      await db.historialTasas.add({
        tasaBCV: tasas.bcv,
        tasaParalelo: tasas.paralelo,
        brecha: tasas.brecha,
        fecha: tasas.fechaActualizacion,
        hora: tasas.fechaActualizacion.toLocaleTimeString('es-VE', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        fuente: desdeCache ? 'Cache' : 'DolarApi',
        createdAt: new Date(),
      });

      setProgreso(100);

      // Actualizar estado
      const resultadoFinal: SincronizacionResultado = {
        tasas,
        comparacion,
        desdeCache,
        mensaje,
      };

      setResultado(resultadoFinal);
      setUltimaSincronizacion(new Date());
      setEstado('success');

      // Resetear estado después de 3 segundos
      setTimeout(() => {
        setEstado('idle');
        setProgreso(0);
      }, 3000);

      return resultadoFinal;
    } catch (err: any) {
      const errorMsg = err.message || 'Error desconocido al sincronizar';
      setError(errorMsg);
      setEstado('error');
      setProgreso(0);
      throw err;
    }
  }, []);

  /**
   * Obtiene las tasas guardadas (de cache o última sincronización)
   */
  const obtenerTasasGuardadas = useCallback((): TasasSincronizadas | null => {
    return dolarApiService.obtenerDeLocalStorage();
  }, []);

  /**
   * Verifica si hay conexión a internet
   */
  const hayConexion = useCallback((): boolean => {
    return dolarApiService.hayConexion();
  }, []);

  /**
   * Formatea el tiempo transcurrido desde la última sincronización
   */
  const formatoTiempoTranscurrido = useCallback((): string => {
    if (!ultimaSincronizacion) return 'Nunca';

    const ahora = new Date();
    const diff = ahora.getTime() - ultimaSincronizacion.getTime();
    
    const minutos = Math.floor(diff / 60000);
    const horas = Math.floor(minutos / 60);
    const dias = Math.floor(horas / 24);

    if (dias > 0) return `hace ${dias} día${dias > 1 ? 's' : ''}`;
    if (horas > 0) return `hace ${horas} hora${horas > 1 ? 's' : ''}`;
    if (minutos > 0) return `hace ${minutos} minuto${minutos > 1 ? 's' : ''}`;
    return 'hace unos segundos';
  }, [ultimaSincronizacion]);

  return {
    // Estados
    estado,
    resultado,
    error,
    ultimaSincronizacion,
    progreso,
    
    // Funciones
    sincronizar,
    obtenerTasasGuardadas,
    hayConexion,
    formatoTiempoTranscurrido,
    
    // Helpers booleanos
    estaCargando: estado === 'loading',
    fueExitoso: estado === 'success',
    huboError: estado === 'error',
  };
}

export default useSincronizacionTasas;
