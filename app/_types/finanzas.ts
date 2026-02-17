/**
 * Tipos para el sistema de cálculo de precios Venezuela
 * Maneja la dualidad cambiaria BCV vs Paralelo
 */

// ============================================================================
// CONFIGURACIÓN CAMBIARIA
// ============================================================================

export interface ConfiguracionCambiaria {
  id?: number;
  tasaBCV: number;           // Tasa oficial BCV (Bs/USD)
  tasaParalelo: number;      // Tasa paralelo/reposición (Bs/USD)
  margenGlobal: number;      // Margen de ganancia deseado (%)
  fecha: Date;               // Fecha de la configuración
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================================================
// HISTORIAL DE TASAS
// ============================================================================

export interface HistorialTasa {
  id?: number;
  tasaBCV: number;
  tasaParalelo: number;
  brecha: number;            // Diferencia porcentual entre tasas
  fecha: Date;               // Fecha del registro
  hora: string;              // Hora del registro (HH:MM)
  fuente?: string;           // Fuente de la tasa (opcional)
  createdAt?: Date;
}

// ============================================================================
// PRODUCTOS Y CÁLCULOS
// ============================================================================

export interface ProductoCalculo {
  id?: number;
  sku: string;               // SKU del producto
  nombre: string;            // Nombre del producto
  costoUSD: number;          // Costo de compra en USD
  margenAplicado: number;    // Margen usado en el cálculo (puede ser global o específico)
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CalculoPrecio {
  id?: number;
  productoId: number;
  configTasaId: number;
  
  // Datos de entrada
  costoUSD: number;
  margenPorcentaje: number;
  tasaBCV: number;
  tasaParalelo: number;
  
  // Cálculos intermedios
  precioBaseUSD: number;           // Precio con margen: costo / (1 - margen)
  factorProteccion: number;        // tasaParalelo / tasaBCV
  brechaCambiaria: number;         // (paralelo - BCV) / BCV * 100
  
  // Precios finales
  precioVentaUSD: number;          // Precio base en USD
  precioVentaBsProtegido: number;  // Precio base * factor * tasaBCV
  precioVentaBsSinProteccion: number; // Precio base * tasaBCV
  
  // Análisis de rentabilidad
  gananciaEsperadaUSD: number;     // Ganancia si no hubiera brecha
  gananciaRealUSD: number;         // Ganancia real considerando brecha
  gananciaRealPorcentaje: number;  // Margen real efectivo
  perdidaPorBrechaUSD: number;     // Pérdida en USD por la brecha
  perdidaPorBrechaPorcentaje: number; // Pérdida como % del margen esperado
  
  // Flags de alerta
  esGananciaBaja: boolean;         // < 5%
  esPerdida: boolean;              // Ganancia negativa
  
  fechaCalculo: Date;
  createdAt?: Date;
}

// ============================================================================
// RESUMEN Y ESTADÍSTICAS
// ============================================================================

export interface ResumenCalculos {
  totalProductos: number;
  productosConPerdida: number;
  productosGananciaBaja: number;
  promedioGananciaReal: number;
  perdidaTotalPorBrecha: number;
}

export interface EstadisticasTasas {
  promedioBCV: number;
  promedioParalelo: number;
  brechaPromedio: number;
  brechaMinima: number;
  brechaMaxima: number;
  variacionBCV: number;      // % de cambio respecto a ayer
  variacionParalelo: number;
}

// ============================================================================
// TIPOS AUXILIARES
// ============================================================================

export type TipoTasa = 'BCV' | 'PARALELO';

export interface FiltroHistorial {
  fechaInicio?: Date;
  fechaFin?: Date;
  horaMin?: string;
  horaMax?: string;
}

export interface ComparativaTasas {
  fecha: Date;
  tasaBCV: number;
  tasaParalelo: number;
  diferencia: number;
  brechaPorcentaje: number;
}
