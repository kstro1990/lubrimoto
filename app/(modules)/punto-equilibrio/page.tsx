"use client";

import React, { useState } from 'react';
import { 
  Target, 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  TrendingDown,
  ArrowRightLeft,
  BarChart3
} from 'lucide-react';
import { usePuntoEquilibrio } from '@/app/_hooks/usePuntoEquilibrio';
import { useNotifications } from '@/app/_components/NotificationProvider';
import { GastoFijo } from '@/app/_db/db';

export default function PuntoEquilibrioPage() {
  const { 
    estado, 
    cargando, 
    error,
    guardarGastoFijo,
    actualizarGastoFijo,
    eliminarGastoFijo,
    guardarConfiguracionMeta,
    formatearUSD,
    formatearPorcentaje,
  } = usePuntoEquilibrio();

  const { success, error: showError } = useNotifications();
  
  const [showGastoForm, setShowGastoForm] = useState(false);
  const [showMetaForm, setShowMetaForm] = useState(false);
  const [editingGasto, setEditingGasto] = useState<GastoFijo | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'gastos' | 'config'>('dashboard');

  // Form states
  const [gastoForm, setGastoForm] = useState<{
    nombre: string;
    montoUSD: number;
    categoria: 'fijo' | 'variable';
    frecuencia: 'mensual' | 'semanal' | 'diario';
    notas: string;
  }>({
    nombre: '',
    montoUSD: 0,
    categoria: 'fijo',
    frecuencia: 'mensual',
    notas: '',
  });

  const [metaForm, setMetaForm] = useState({
    utilidadDeseadaUSD: 0,
    margenPromedioEsperado: 30,
    diasLaborales: 26,
  });

  const handleSaveGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingGasto?.id) {
        await actualizarGastoFijo(editingGasto.id, {
          ...gastoForm,
          updatedAt: new Date(),
        });
        success('Gasto actualizado', 'El gasto fijo ha sido actualizado');
      } else {
        await guardarGastoFijo({
          ...gastoForm,
          activo: true,
          fechaInicio: new Date(),
        });
        success('Gasto agregado', 'El gasto fijo ha sido registrado');
      }
      setShowGastoForm(false);
      setEditingGasto(null);
      setGastoForm({ nombre: '', montoUSD: 0, categoria: 'fijo', frecuencia: 'mensual', notas: '' });
    } catch (err) {
      showError('Error', 'No se pudo guardar el gasto');
    }
  };

  const handleSaveMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await guardarConfiguracionMeta(
        metaForm.utilidadDeseadaUSD,
        metaForm.margenPromedioEsperado,
        metaForm.diasLaborales
      );
      success('Configuración guardada', 'La meta del mes ha sido configurada');
      setShowMetaForm(false);
    } catch (err) {
      showError('Error', 'No se pudo guardar la configuración');
    }
  };

  const handleDeleteGasto = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este gasto?')) return;
    try {
      await eliminarGastoFijo(id);
      success('Gasto eliminado', 'El gasto ha sido eliminado');
    } catch (err) {
      showError('Error', 'No se pudo eliminar el gasto');
    }
  };

  const fechaActual = new Date();
  const nombreMes = fechaActual.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });

  if (cargando) {
    return (
      <div className="container mx-auto p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Calculando métricas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error al cargar datos</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const { calculos, progreso, gastosFijos } = estado;

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Target className="h-8 w-8 mr-3 text-blue-600" />
            Punto de Equilibrio
          </h1>
          <p className="text-gray-600 mt-1 capitalize">{nombreMes}</p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              activeTab === 'dashboard' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('gastos')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              activeTab === 'gastos' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Gastos
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              activeTab === 'config' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Configuración
          </button>
        </div>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <>
          {/* KPIs Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Punto de Equilibrio */}
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 shadow-sm border border-orange-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-orange-800">Punto de Equilibrio</h3>
                <TrendingUp className="h-5 w-5 text-orange-600" />
              </div>
              <p className="text-3xl font-bold text-orange-900">
                {formatearUSD(calculos.puntoEquilibrio)}
              </p>
              <p className="text-sm text-orange-700 mt-2">
                Ventas mínimas para cubrir costos
              </p>
              {progreso.ventasMesActual >= calculos.puntoEquilibrio && (
                <div className="mt-3 flex items-center text-green-700 text-sm">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  ¡Punto de equilibrio alcanzado!
                </div>
              )}
            </div>

            {/* Meta Mensual */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 shadow-sm border border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-blue-800">Meta Mensual</h3>
                <Target className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-blue-900">
                {formatearUSD(calculos.metaMensual)}
              </p>
              <p className="text-sm text-blue-700 mt-2">
                Incluye utilidad deseada
              </p>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-blue-700 mb-1">
                  <span>Progreso: {formatearPorcentaje(progreso.porcentajeCumplimiento)}</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(progreso.porcentajeCumplimiento, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Meta Diaria */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 shadow-sm border border-green-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-green-800">Meta Diaria</h3>
                <Calendar className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-green-900">
                {formatearUSD(calculos.metaDiaria)}
              </p>
              <p className="text-sm text-green-700 mt-2">
                Promedio por día laboral
              </p>
              <div className="mt-3">
                {progreso.metaDiariaCumplida ? (
                  <div className="flex items-center text-green-700 text-sm">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Hoy: {formatearUSD(progreso.ventasHoy)} ✓
                  </div>
                ) : (
                  <div className="flex items-center text-orange-600 text-sm">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    Hoy: {formatearUSD(progreso.ventasHoy)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Progreso del Mes */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Progreso del Mes
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">Ventas del mes</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatearUSD(progreso.ventasMesActual)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Meta</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatearUSD(calculos.metaMensual)}
                  </p>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
                      {formatearPorcentaje(progreso.porcentajeCumplimiento)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold inline-block text-gray-600">
                      Faltan: {formatearUSD(progreso.faltanteParaMeta)}
                    </span>
                  </div>
                </div>
                <div className="overflow-hidden h-4 mb-4 text-xs flex rounded bg-gray-200">
                  <div 
                    style={{ width: `${Math.min(progreso.porcentajeCumplimiento, 100)}%` }}
                    className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ${
                      progreso.porcentajeCumplimiento >= 100 
                        ? 'bg-green-500' 
                        : progreso.porcentajeCumplimiento >= 50 
                          ? 'bg-blue-500' 
                          : 'bg-orange-500'
                    }`}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                <div>
                  <p className="text-xs text-gray-500">Días restantes</p>
                  <p className="text-lg font-semibold">{progreso.diasRestantes}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Margen promedio</p>
                  <p className="text-lg font-semibold">{formatearPorcentaje(calculos.margenPromedio)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Proyección final</p>
                  <p className={`text-lg font-semibold ${progreso.proyeccionFinal >= calculos.metaMensual ? 'text-green-600' : 'text-red-600'}`}>
                    {formatearUSD(progreso.proyeccionFinal)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Costos fijos</p>
                  <p className="text-lg font-semibold">{formatearUSD(calculos.costosFijosTotales)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Resumen de Gastos */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                Resumen de Gastos Fijos
              </h3>
              <button
                onClick={() => setActiveTab('gastos')}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Ver todos →
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">Total gastos</p>
                <p className="text-xl font-bold">{formatearUSD(calculos.costosFijosTotales)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">Cantidad</p>
                <p className="text-xl font-bold">{gastosFijos.length}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">Gastos fijos</p>
                <p className="text-xl font-bold">
                  {gastosFijos.filter(g => g.categoria === 'fijo').length}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">Variables</p>
                <p className="text-xl font-bold">
                  {gastosFijos.filter(g => g.categoria === 'variable').length}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Gastos Tab */}
      {activeTab === 'gastos' && (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-6 border-b flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Gestión de Gastos Fijos</h3>
            <button
              onClick={() => {
                setEditingGasto(null);
                setGastoForm({ nombre: '', montoUSD: 0, categoria: 'fijo', frecuencia: 'mensual', notas: '' });
                setShowGastoForm(true);
              }}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Gasto
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Concepto</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Categoría</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Frecuencia</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {gastosFijos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No hay gastos registrados</p>
                    </td>
                  </tr>
                ) : (
                  gastosFijos.map((gasto) => (
                    <tr key={gasto.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{gasto.nombre}</p>
                          {gasto.notas && (
                            <p className="text-xs text-gray-500">{gasto.notas}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {formatearUSD(gasto.montoUSD)}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          gasto.categoria === 'fijo' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {gasto.categoria === 'fijo' ? 'Fijo' : 'Variable'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-600 capitalize">
                        {gasto.frecuencia}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center space-x-2">
                          <button
                            onClick={() => {
                              setEditingGasto(gasto);
                              setGastoForm({
                                nombre: gasto.nombre,
                                montoUSD: gasto.montoUSD,
                                categoria: gasto.categoria,
                                frecuencia: gasto.frecuencia,
                                notas: gasto.notas || '',
                              });
                              setShowGastoForm(true);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => gasto.id && handleDeleteGasto(gasto.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Config Tab */}
      {activeTab === 'config' && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Configuración de Metas</h3>
          
          <form onSubmit={handleSaveMeta} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Utilidad Deseada (USD)
              </label>
              <input
                type="number"
                value={metaForm.utilidadDeseadaUSD}
                onChange={(e) => setMetaForm({ ...metaForm, utilidadDeseadaUSD: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="5000"
                step="0.01"
              />
              <p className="text-xs text-gray-500 mt-1">
                Ganancia neta que deseas obtener este mes
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Margen Promedio Esperado (%)
              </label>
              <input
                type="number"
                value={metaForm.margenPromedioEsperado}
                onChange={(e) => setMetaForm({ ...metaForm, margenPromedioEsperado: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="30"
                min="1"
                max="100"
              />
              <p className="text-xs text-gray-500 mt-1">
                Promedio actual: {formatearPorcentaje(calculos.margenPromedio)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Días Laborales del Mes
              </label>
              <input
                type="number"
                value={metaForm.diasLaborales}
                onChange={(e) => setMetaForm({ ...metaForm, diasLaborales: parseInt(e.target.value) || 26 })}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="26"
                min="1"
                max="31"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
            >
              Guardar Configuración
            </button>
          </form>

          {estado.meta && (
            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Configuración Actual</h4>
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-600">Utilidad deseada:</span> {formatearUSD(estado.meta.utilidadDeseadaUSD)}</p>
                <p><span className="text-gray-600">Margen esperado:</span> {formatearPorcentaje(estado.meta.margenPromedioEsperado)}</p>
                <p><span className="text-gray-600">Días laborales:</span> {estado.meta.diasLaborales}</p>
                <p><span className="text-gray-600">Punto de equilibrio:</span> {formatearUSD(estado.meta.puntoEquilibrioCalculado)}</p>
                <p><span className="text-gray-600">Meta mensual:</span> {formatearUSD(estado.meta.metaMensualCalculada)}</p>
                <p><span className="text-gray-600">Meta diaria:</span> {formatearUSD(estado.meta.metaDiariaCalculada)}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Gasto */}
      {showGastoForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowGastoForm(false)} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
              <h3 className="text-lg font-semibold mb-4">
                {editingGasto ? 'Editar Gasto' : 'Nuevo Gasto'}
              </h3>
              <form onSubmit={handleSaveGasto} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={gastoForm.nombre}
                    onChange={(e) => setGastoForm({ ...gastoForm, nombre: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto (USD)</label>
                  <input
                    type="number"
                    value={gastoForm.montoUSD}
                    onChange={(e) => setGastoForm({ ...gastoForm, montoUSD: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-md"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <select
                    value={gastoForm.categoria}
                    onChange={(e) => setGastoForm({ ...gastoForm, categoria: e.target.value as 'fijo' | 'variable' })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="fijo">Fijo</option>
                    <option value="variable">Variable</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia</label>
                  <select
                    value={gastoForm.frecuencia}
                    onChange={(e) => setGastoForm({ ...gastoForm, frecuencia: e.target.value as 'mensual' | 'semanal' | 'diario' })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="mensual">Mensual</option>
                    <option value="semanal">Semanal</option>
                    <option value="diario">Diario</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                  <textarea
                    value={gastoForm.notas}
                    onChange={(e) => setGastoForm({ ...gastoForm, notas: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    rows={2}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowGastoForm(false)}
                    className="flex-1 py-2 px-4 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    {editingGasto ? 'Actualizar' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
