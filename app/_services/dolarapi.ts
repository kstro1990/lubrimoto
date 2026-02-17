/**
 * Servicio para consumir la API de DolarApi (Venezuela)
 * https://dolarapi.com/docs/venezuela/
 */

const BASE_URL = 'https://ve.dolarapi.com/v1';

export interface DolarApiResponse {
  fuente: string;
  nombre: string;
  compra: number | null;
  venta: number | null;
  promedio: number;
  fechaActualizacion: string;
}

export interface TasasSincronizadas {
  bcv: number;
  paralelo: number;
  brecha: number;
  fechaActualizacion: Date;
}

export interface ComparacionTasas {
  bcv: {
    actual: number;
    anterior: number | null;
    cambio: number;
    cambioPorcentaje: number;
  };
  paralelo: {
    actual: number;
    anterior: number | null;
    cambio: number;
    cambioPorcentaje: number;
  };
  brecha: {
    actual: number;
    anterior: number | null;
    cambio: number;
  };
}

class DolarApiService {
  private lastRequestTime: number = 0;
  private readonly minRequestInterval: number = 5000; // 5 segundos entre requests

  /**
   * Verifica si ha pasado suficiente tiempo desde el último request
   */
  private canMakeRequest(): boolean {
    const now = Date.now();
    if (now - this.lastRequestTime < this.minRequestInterval) {
      return false;
    }
    this.lastRequestTime = now;
    return true;
  }

  /**
   * Obtiene la tasa BCV (Oficial)
   */
  async fetchTasaBCV(): Promise<number> {
    try {
      const response = await fetch(`${BASE_URL}/dolares/oficial`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data: DolarApiResponse = await response.json();
      
      if (!data.promedio || data.promedio <= 0) {
        throw new Error('Tasa BCV inválida recibida de la API');
      }

      return data.promedio;
    } catch (error) {
      console.error('Error fetching BCV rate:', error);
      throw error;
    }
  }

  /**
   * Obtiene la tasa Paralelo
   */
  async fetchTasaParalelo(): Promise<number> {
    try {
      const response = await fetch(`${BASE_URL}/dolares/paralelo`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data: DolarApiResponse = await response.json();
      
      if (!data.promedio || data.promedio <= 0) {
        throw new Error('Tasa Paralelo inválida recibida de la API');
      }

      return data.promedio;
    } catch (error) {
      console.error('Error fetching Paralelo rate:', error);
      throw error;
    }
  }

  /**
   * Obtiene todas las tasas disponibles
   */
  async fetchTodasLasTasas(): Promise<DolarApiResponse[]> {
    try {
      const response = await fetch(`${BASE_URL}/dolares`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching all rates:', error);
      throw error;
    }
  }

  /**
   * Sincroniza ambas tasas (BCV y Paralelo)
   */
  async sincronizarTasas(): Promise<TasasSincronizadas> {
    if (!this.canMakeRequest()) {
      throw new Error('Por favor espera unos segundos antes de sincronizar nuevamente');
    }

    try {
      // Llamar ambos endpoints en paralelo
      const [bcv, paralelo] = await Promise.all([
        this.fetchTasaBCV(),
        this.fetchTasaParalelo(),
      ]);

      // Calcular brecha
      const brecha = ((paralelo - bcv) / bcv) * 100;

      return {
        bcv,
        paralelo,
        brecha,
        fechaActualizacion: new Date(),
      };
    } catch (error) {
      console.error('Error en sincronización:', error);
      throw error;
    }
  }

  /**
   * Compara las tasas actuales con las anteriores
   */
  compararTasas(
    actual: TasasSincronizadas,
    anterior: TasasSincronizadas | null
  ): ComparacionTasas {
    if (!anterior) {
      return {
        bcv: {
          actual: actual.bcv,
          anterior: null,
          cambio: 0,
          cambioPorcentaje: 0,
        },
        paralelo: {
          actual: actual.paralelo,
          anterior: null,
          cambio: 0,
          cambioPorcentaje: 0,
        },
        brecha: {
          actual: actual.brecha,
          anterior: null,
          cambio: 0,
        },
      };
    }

    const cambioBCV = actual.bcv - anterior.bcv;
    const cambioParalelo = actual.paralelo - anterior.paralelo;

    return {
      bcv: {
        actual: actual.bcv,
        anterior: anterior.bcv,
        cambio: cambioBCV,
        cambioPorcentaje: (cambioBCV / anterior.bcv) * 100,
      },
      paralelo: {
        actual: actual.paralelo,
        anterior: anterior.paralelo,
        cambio: cambioParalelo,
        cambioPorcentaje: (cambioParalelo / anterior.paralelo) * 100,
      },
      brecha: {
        actual: actual.brecha,
        anterior: anterior.brecha,
        cambio: actual.brecha - anterior.brecha,
      },
    };
  }

  /**
   * Verifica si hay conexión a internet
   */
  hayConexion(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine;
  }

  /**
   * Guarda las últimas tasas en localStorage (fallback offline)
   */
  guardarEnLocalStorage(tasas: TasasSincronizadas): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dolarapi_ultimas_tasas', JSON.stringify({
        ...tasas,
        fechaActualizacion: tasas.fechaActualizacion.toISOString(),
      }));
      localStorage.setItem('dolarapi_ultima_sincronizacion', new Date().toISOString());
    }
  }

  /**
   * Recupera las últimas tasas de localStorage
   */
  obtenerDeLocalStorage(): TasasSincronizadas | null {
    if (typeof window === 'undefined') return null;

    const data = localStorage.getItem('dolarapi_ultimas_tasas');
    if (!data) return null;

    try {
      const parsed = JSON.parse(data);
      return {
        ...parsed,
        fechaActualizacion: new Date(parsed.fechaActualizacion),
      };
    } catch {
      return null;
    }
  }

  /**
   * Obtiene la fecha de última sincronización
   */
  obtenerUltimaSincronizacion(): Date | null {
    if (typeof window === 'undefined') return null;

    const fecha = localStorage.getItem('dolarapi_ultima_sincronizacion');
    return fecha ? new Date(fecha) : null;
  }

  /**
   * Intenta sincronizar, con fallback a localStorage si no hay conexión
   */
  async sincronizarConFallback(): Promise<{
    tasas: TasasSincronizadas;
    desdeCache: boolean;
    mensaje?: string;
  }> {
    // Si hay conexión, intentar sincronizar con API
    if (this.hayConexion()) {
      try {
        const tasas = await this.sincronizarTasas();
        this.guardarEnLocalStorage(tasas);
        return {
          tasas,
          desdeCache: false,
        };
      } catch (error) {
        // Si falla la API, intentar usar cache
        const cache = this.obtenerDeLocalStorage();
        if (cache) {
          return {
            tasas: cache,
            desdeCache: true,
            mensaje: 'Usando datos en caché (la API no respondió)',
          };
        }
        throw error;
      }
    }

    // Sin conexión, usar cache
    const cache = this.obtenerDeLocalStorage();
    if (cache) {
      return {
        tasas: cache,
        desdeCache: true,
        mensaje: 'Sin conexión a internet. Usando datos en caché.',
      };
    }

    throw new Error('Sin conexión a internet y no hay datos en caché');
  }
}

// Exportar instancia singleton
export const dolarApiService = new DolarApiService();

export default dolarApiService;
