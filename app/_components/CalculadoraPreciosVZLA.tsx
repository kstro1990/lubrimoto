"use client";

import React, { useState, useEffect } from 'react';
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  RefreshCcw,
  Save,
  History,
  Percent,
  ArrowRightLeft,
  Wifi,
  Clock,
} from 'lucide-react';
import { useFinanzasVZLA, CalculoOutput } from '@/app/_hooks/useFinanzasVZLA';
import { useSincronizacionTasas } from '@/app/_hooks/useSincronizacionTasas';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/app/_db/db';
import { useNotifications } from '@/app/_components/NotificationProvider';
import { useTasas } from '@/app/_contexts/TasasContext';

// ============================================================================
// INTERFACES
// ============================================================================

interface ProductoCalculoRow {
  id: number;
  sku: string;
  nombre: string;
  costoUSD: number;
  sinCosto: boolean;
}

// ============================================================================
// COMPONENTE INPUT MONEDA
// ============================================================================

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  placeholder?: string;
}

const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  prefix = '',
  suffix = '',
  min = 0,
  max,
  step = 0.01,
  className = '',
  placeholder = '0.00',
}) => {
  const [displayValue, setDisplayValue] = useState<string>(value.toFixed(2));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value.toFixed(2));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9.]/g, '');
    setDisplayValue(rawValue);

    const numValue = parseFloat(rawValue);
    if (!isNaN(numValue)) {
      let finalValue = numValue;
      if (min !== undefined && numValue < min) finalValue = min;
      if (max !== undefined && numValue > max) finalValue = max;
      onChange(finalValue);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    setDisplayValue(value.toString());
  };

  const handleBlur = () => {
    setIsFocused(false);
    setDisplayValue(value.toFixed(2));
  };

  return (
    <div className={`relative ${className}`}>
      {prefix && (
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-right font-mono ${
          prefix ? 'pl-8' : ''
        } ${suffix ? 'pr-8' : ''}`}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">
          {suffix}
        </span>
      )}
    </div>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function CalculadoraPreciosVZLA() {
  const {
    tasaBCV,
    setTasaBCV,
    tasaParalelo,
    setTasaParalelo,
    margenGlobal,
    setMargenGlobal,
    factorProteccionActual,
    brechaActual,
    calcularPrecio,
    formatearBs,
    formatearUSD,
    formatearPorcentaje,
    formatearNumero,
    guardarConfiguracion,
    registrarTasaHistorial,
    configActiva,
    historialTasas,
  } = useFinanzasVZLA();

  const {
    sincronizar,
    estaCargando: sincronizando,
    formatoTiempoTranscurrido,
    ultimaSincronizacion,
  } = useSincronizacionTasas();

  const { success, error: showError } = useNotifications();
  const { tasas, recargarTasas } = useTasas();

  const productosDB = useLiveQuery(() => db.products.toArray(), []);

  const [productos, setProductos] = useState<ProductoCalculoRow[]>([]);
  const [calculos, setCalculos] = useState<CalculoOutput[]>([]);
  const [showHistorial, setShowHistorial] = useState(false);
  const [tasasSincronizadas, setTasasSincronizadas] = useState(false);
  const [origenTasas, setOrigenTasas] = useState<'api' | 'config' | 'manual'>('manual');

  // Priority 1: load from saved config (fires when Dexie resolves)
  useEffect(() => {
    if (configActiva) {
      setTasaBCV(configActiva.tasaBCV);
      setTasaParalelo(configActiva.tasaParalelo);
      setMargenGlobal(configActiva.margenGlobal);
      setOrigenTasas('config');
      setTasasSincronizadas(true);
    }
  }, [configActiva, setTasaBCV, setTasaParalelo, setMargenGlobal]);

  // Priority 2: fallback to context rates if no saved config
  useEffect(() => {
    if (tasas && !tasasSincronizadas) {
      setTasaBCV(tasas.bcv);
      setTasaParalelo(tasas.paralelo);
      setTasasSincronizadas(true);
      setOrigenTasas('api');
    }
  }, [tasas, tasasSincronizadas, setTasaBCV, setTasaParalelo]);

  // Recargar tasas del contexto al montar
  useEffect(() => {
    recargarTasas();
  }, [recargarTasas]);

  // Construir filas de productos desde la BD
  useEffect(() => {
    if (productosDB) {
      setProductos(productosDB.map(p => ({
        id: p.id!,
        sku: p.sku,
        nombre: p.name,
        costoUSD: p.costUsd || 0,
        sinCosto: !p.costUsd || p.costUsd === 0,
      })));
    }
  }, [productosDB]);

  // Recalcular cuando cambian tasas, margen o productos
  useEffect(() => {
    setCalculos(productos.map(p =>
      calcularPrecio({
        costoUSD: p.costoUSD,
        margenPorcentaje: margenGlobal,
        tasaBCV,
        tasaParalelo,
      })
    ));
  }, [productos, tasaBCV, tasaParalelo, margenGlobal, calcularPrecio]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleCostoChange = (index: number, nuevoCosto: number) => {
    const nuevos = [...productos];
    nuevos[index] = { ...nuevos[index], costoUSD: nuevoCosto, sinCosto: nuevoCosto === 0 };
    setProductos(nuevos);
  };

  const handleGuardarConfiguracion = async () => {
    try {
      await guardarConfiguracion({
        tasaBCV,
        tasaParalelo,
        margenGlobal,
        fecha: new Date(),
        esActiva: true,
      });
      setOrigenTasas('config');
      success('Configuración guardada', 'Las tasas y margen han sido guardados');
    } catch {
      showError('Error', 'No se pudo guardar la configuración');
    }
  };

  const handleRegistrarTasa = async () => {
    try {
      await registrarTasaHistorial(tasaBCV, tasaParalelo, 'Manual');
      success('Tasa registrada', 'La tasa ha sido guardada en el historial');
    } catch {
      showError('Error', 'No se pudo registrar la tasa');
    }
  };

  const handleSincronizarDesdeAPI = async () => {
    try {
      const resultado = await sincronizar();
      setTasaBCV(resultado.tasas.bcv);
      setTasaParalelo(resultado.tasas.paralelo);
      setTasasSincronizadas(true);
      setOrigenTasas('api');
      success(
        'Tasas actualizadas',
        `BCV: ${resultado.tasas.bcv.toFixed(2)} | Paralelo: ${resultado.tasas.paralelo.toFixed(2)}${resultado.desdeCache ? ' (desde caché)' : ''}`
      );
    } catch (err: any) {
      showError('Error', err.message || 'No se pudo sincronizar las tasas');
    }
  };

  // ============================================================================
  // ESTADÍSTICAS (excluye productos sin costo)
  // ============================================================================

  const estadisticas = React.useMemo(() => {
    const calculosValidos = calculos.filter((_, i) => !productos[i]?.sinCosto);
    if (calculosValidos.length === 0) return null;

    return {
      totalProductos: calculosValidos.length,
      productosSinCosto: productos.filter(p => p.sinCosto).length,
      productosConPerdida: calculosValidos.filter(c => c.esPerdida).length,
      productosGananciaBaja: calculosValidos.filter(c => c.esGananciaBaja).length,
      promedioGananciaReal: calculosValidos.reduce((a, c) => a + c.gananciaRealUSD, 0) / calculosValidos.length,
      perdidaTotalPorBrecha: calculosValidos.reduce((sum, c) => sum + c.perdidaPorBrechaUSD, 0),
    };
  }, [calculos, productos]);

  // ============================================================================
  // RENDER
  // ============================================================================

  const origenLabel = {
    api: { icon: <Wifi className="h-3 w-3 mr-1 text-green-500" />, text: `Desde API · ${formatoTiempoTranscurrido()}` },
    config: { icon: <Save className="h-3 w-3 mr-1 text-blue-500" />, text: 'Desde configuración guardada' },
    manual: { icon: <AlertTriangle className="h-3 w-3 mr-1 text-yellow-500" />, text: 'Ingresado manualmente' },
  }[origenTasas];

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Calculator className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Calculadora de Precios Venezuela</h1>
            <p className="text-gray-600">
              Gestión de precios considerando brecha cambiaria BCV vs Paralelo
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSincronizarDesdeAPI}
            disabled={sincronizando}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            {sincronizando ? (
              <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Wifi className="h-4 w-4 mr-2" />
            )}
            {sincronizando ? 'Sincronizando...' : 'Sincronizar API'}
          </button>
          <button
            onClick={() => setShowHistorial(!showHistorial)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <History className="h-4 w-4 mr-2" />
            {showHistorial ? 'Ocultar Historial' : 'Ver Historial'}
          </button>
        </div>
      </div>

      {/* Panel de Configuración Cambiaria */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
        <h2 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
          <ArrowRightLeft className="h-5 w-5 mr-2" />
          Configuración Cambiaria
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Tasa BCV */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tasa BCV (Oficial)
            </label>
            <CurrencyInput
              value={tasaBCV}
              onChange={(v) => { setTasaBCV(v); setOrigenTasas('manual'); }}
              prefix="Bs."
              step={0.01}
              className="bg-white"
            />
          </div>

          {/* Tasa Paralelo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tasa Paralelo
            </label>
            <CurrencyInput
              value={tasaParalelo}
              onChange={(v) => { setTasaParalelo(v); setOrigenTasas('manual'); }}
              prefix="Bs."
              step={0.01}
              className="bg-white"
            />
          </div>

          {/* Factor de Protección */}
          <div className="bg-white rounded-md p-3 border">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Factor Protección
            </label>
            <p className="text-2xl font-bold text-indigo-600">
              {formatearNumero(factorProteccionActual, 3)}
            </p>
          </div>

          {/* Brecha */}
          <div className={`rounded-md p-3 border ${brechaActual > 5 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Brecha Cambiaria
            </label>
            <p className={`text-2xl font-bold ${brechaActual > 5 ? 'text-red-600' : 'text-green-600'}`}>
              {formatearPorcentaje(brechaActual, 2)}
            </p>
          </div>
        </div>

        {/* Origen de las tasas */}
        <p className="mt-2 text-xs text-gray-500 flex items-center">
          {origenLabel.icon}
          {origenLabel.text}
        </p>

        {/* Margen Global */}
        <div className="mt-4 flex items-end gap-4 flex-wrap">
          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Percent className="h-4 w-4 inline mr-1" />
              Margen de Ganancia Global
            </label>
            <CurrencyInput
              value={margenGlobal}
              onChange={setMargenGlobal}
              suffix="%"
              min={0}
              max={99}
              step={0.5}
              className="bg-white"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleGuardarConfiguracion}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Save className="h-4 w-4 mr-2" />
              Guardar Config.
            </button>
            <button
              onClick={handleRegistrarTasa}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Clock className="h-4 w-4 mr-2" />
              Registrar Tasa
            </button>
          </div>
        </div>
      </div>

      {/* Historial de Tasas */}
      {showHistorial && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <History className="h-5 w-5 mr-2" />
              Historial de Tasas
            </h3>
            {historialTasas && (
              <span className="text-sm text-gray-500">{historialTasas.length} registros</span>
            )}
          </div>
          {!historialTasas || historialTasas.length === 0 ? (
            <p className="px-6 py-8 text-center text-gray-500">
              No hay tasas registradas aún. Usa "Registrar Tasa" o "Sincronizar API".
            </p>
          ) : (
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">BCV</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Paralelo</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Brecha</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Fuente</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {historialTasas.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-900 whitespace-nowrap">
                        {new Date(t.fecha).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: '2-digit' })} {t.hora}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{formatearNumero(t.tasaBCV, 2)}</td>
                      <td className="px-4 py-2 text-right font-mono">{formatearNumero(t.tasaParalelo, 2)}</td>
                      <td className={`px-4 py-2 text-right font-medium ${t.brecha > 5 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatearPorcentaje(t.brecha, 2)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{t.fuente || 'Manual'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Estadísticas */}
      {estadisticas && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <p className="text-sm text-gray-600">Productos</p>
            <p className="text-2xl font-bold">{estadisticas.totalProductos}</p>
            {estadisticas.productosSinCosto > 0 && (
              <p className="text-xs text-yellow-600 mt-1">
                +{estadisticas.productosSinCosto} sin costo definido
              </p>
            )}
          </div>
          <div className={`p-4 rounded-lg shadow-sm border ${estadisticas.productosConPerdida > 0 ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
            <p className="text-sm text-gray-600">Con Pérdida</p>
            <p className={`text-2xl font-bold ${estadisticas.productosConPerdida > 0 ? 'text-red-600' : ''}`}>
              {estadisticas.productosConPerdida}
            </p>
          </div>
          <div className={`p-4 rounded-lg shadow-sm border ${estadisticas.productosGananciaBaja > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
            <p className="text-sm text-gray-600">Ganancia Baja (&lt;5%)</p>
            <p className={`text-2xl font-bold ${estadisticas.productosGananciaBaja > 0 ? 'text-yellow-600' : ''}`}>
              {estadisticas.productosGananciaBaja}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <p className="text-sm text-gray-600">Pérdida Total por Brecha</p>
            <p className="text-2xl font-bold text-red-600">
              {formatearUSD(estadisticas.perdidaTotalPorBrecha)}
            </p>
          </div>
        </div>
      )}

      {/* Tabla de Productos */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <DollarSign className="h-5 w-5 mr-2" />
            Cálculo de Precios por Producto
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Costo ($)</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <span title="Costo ajustado por brecha cambiaria: Costo × (Paralelo/BCV)">Precio Idea ($)</span>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Precio Base ($)</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Precio en Bs.</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ganancia Real</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {productos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No hay productos en el inventario
                  </td>
                </tr>
              ) : (
                productos.map((producto, index) => {
                  const calculo = calculos[index];

                  // Producto sin costo definido
                  if (producto.sinCosto) {
                    return (
                      <tr key={producto.id} className="bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-500">{producto.nombre}</p>
                            <p className="text-xs text-gray-400 font-mono">{producto.sku}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <CurrencyInput
                            value={producto.costoUSD}
                            onChange={(value) => handleCostoChange(index, value)}
                            prefix="$"
                            className="w-32"
                          />
                        </td>
                        <td colSpan={5} className="px-4 py-3 text-center">
                          <span className="inline-flex items-center text-xs text-yellow-700 bg-yellow-50 px-3 py-1 rounded-full border border-yellow-200">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Sin costo definido — ingresa el costo para ver los cálculos
                          </span>
                        </td>
                      </tr>
                    );
                  }

                  if (!calculo) return null;

                  return (
                    <tr
                      key={producto.id}
                      className={calculo.esPerdida ? 'bg-red-50' : calculo.esGananciaBaja ? 'bg-yellow-50' : 'hover:bg-gray-50'}
                    >
                      <td className="px-4 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{producto.nombre}</p>
                          <p className="text-xs text-gray-500 font-mono">{producto.sku}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <CurrencyInput
                          value={producto.costoUSD}
                          onChange={(value) => handleCostoChange(index, value)}
                          prefix="$"
                          className="w-32"
                        />
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p
                          className={`text-sm font-medium ${calculo.precioIdeaMenorAlCosto ? 'text-red-600' : 'text-blue-600'}`}
                          title={`Costo ajustado por brecha: $${producto.costoUSD.toFixed(2)} × ${calculo.factorProteccion.toFixed(4)} = $${calculo.precioIdea.toFixed(2)}`}
                        >
                          {formatearUSD(calculo.precioIdea)}
                        </p>
                        {calculo.precioIdeaMenorAlCosto && (
                          <p className="text-xs text-red-500 flex items-center justify-end mt-1">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Menor al costo
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          Factor: {calculo.factorProteccion.toFixed(4)}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {formatearUSD(calculo.precioBaseUSD)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Margen: {formatearPorcentaje(calculo.margenPorcentaje)}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="space-y-1">
                          <div>
                            <p className="text-xs font-medium text-indigo-700">Con protección</p>
                            <p className="text-sm font-bold text-gray-900">
                              {formatearBs(calculo.precioVentaBsProtegido)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500">Sin protección</p>
                            <p className="text-sm text-gray-700">
                              {formatearBs(calculo.precioVentaBsSinProteccion)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className={`text-sm font-medium ${calculo.gananciaRealUSD < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatearUSD(calculo.gananciaRealUSD)}
                        </p>
                        <p className={`text-xs ${calculo.gananciaRealPorcentaje < 5 ? 'text-red-500' : 'text-green-500'}`}>
                          {formatearPorcentaje(calculo.gananciaRealPorcentaje, 1)}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {calculo.esPerdida ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <TrendingDown className="h-3 w-3 mr-1" />
                            Pérdida
                          </span>
                        ) : calculo.esGananciaBaja ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Baja
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Panel de Análisis Detallado */}
      {calculos.filter((_, i) => !productos[i]?.sinCosto).length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Análisis de Impacto de la Brecha Cambiaria
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Sin Brecha (Ideal)</h4>
              <p className="text-2xl font-bold text-blue-600">
                {formatearUSD(calculos.filter((_, i) => !productos[i]?.sinCosto).reduce((sum, c) => sum + c.gananciaEsperadaUSD, 0))}
              </p>
              <p className="text-sm text-blue-700">
                Ganancia total esperada
              </p>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-green-900 mb-2">Con Protección</h4>
              <p className="text-2xl font-bold text-green-600">
                {formatearUSD(calculos.filter((_, i) => !productos[i]?.sinCosto).reduce((sum, c) => sum + c.gananciaRealUSD, 0))}
              </p>
              <p className="text-sm text-green-700">
                Ganancia real con factor de protección
              </p>
            </div>

            <div className="bg-red-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-red-900 mb-2">Pérdida por Brecha</h4>
              <p className="text-2xl font-bold text-red-600">
                {formatearUSD(calculos.filter((_, i) => !productos[i]?.sinCosto).reduce((sum, c) => sum + c.perdidaPorBrechaUSD, 0))}
              </p>
              <p className="text-sm text-red-700">
                Pérdida total por diferencial cambiario
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
