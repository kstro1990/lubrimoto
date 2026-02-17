"use client";

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, HistorialTasa } from '@/app/_db/db';
import { 
  Plus, 
  TrendingUp, 
  Calendar, 
  Clock,
  Search,
  ArrowLeft,
  MoreVertical,
  Trash2,
  Edit,
  RefreshCcw,
  TrendingDown,
  AlertCircle,
  Cloud,
  Wifi,
  WifiOff
} from 'lucide-react';
import Link from 'next/link';
import { useNotifications } from '@/app/_components/NotificationProvider';
import { useSincronizacionTasas } from '@/app/_hooks/useSincronizacionTasas';
import { useTasas } from '@/app/_contexts/TasasContext';
import FormularioTasa from './components/FormularioTasa';
import HistorialGrafico from './components/HistorialGrafico';

export default function TasasPage() {
  const { success, error: showError } = useNotifications();
  const { actualizarTasas } = useTasas();
  const { 
    sincronizar, 
    estado, 
    resultado, 
    error: syncError,
    estaCargando,
    hayConexion,
    formatoTiempoTranscurrido,
    ultimaSincronizacion 
  } = useSincronizacionTasas();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTasa, setEditingTasa] = useState<HistorialTasa | null>(null);
  const [showHistorial, setShowHistorial] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [mostrarResultadoSync, setMostrarResultadoSync] = useState(false);

  // Obtener tasas de la base de datos
  const tasas = useLiveQuery(
    () => db.historialTasas.orderBy('fecha').reverse().toArray(),
    []
  );

  // Filtrar tasas
  const filteredTasas = React.useMemo(() => {
    if (!tasas) return [];
    
    let filtered = tasas;
    
    // Filtrar por fecha
    const now = new Date();
    if (dateFilter === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter(t => new Date(t.fecha) >= today);
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(t => new Date(t.fecha) >= weekAgo);
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(t => new Date(t.fecha) >= monthAgo);
    }
    
    // Filtrar por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(t => 
        t.fuente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.fecha.toLocaleDateString().includes(searchTerm)
      );
    }
    
    return filtered;
  }, [tasas, searchTerm, dateFilter]);

  // Calcular estadísticas
  const stats = React.useMemo(() => {
    if (!tasas || tasas.length === 0) return null;
    
    const latest = tasas[0];
    const previous = tasas[1];
    
    const bcvChange = previous ? ((latest.tasaBCV - previous.tasaBCV) / previous.tasaBCV) * 100 : 0;
    const paraleloChange = previous ? ((latest.tasaParalelo - previous.tasaParalelo) / previous.tasaParalelo) * 100 : 0;
    
    const avgBCV = tasas.reduce((sum, t) => sum + t.tasaBCV, 0) / tasas.length;
    const avgParalelo = tasas.reduce((sum, t) => sum + t.tasaParalelo, 0) / tasas.length;
    const avgBrecha = tasas.reduce((sum, t) => sum + t.brecha, 0) / tasas.length;
    
    return {
      latest,
      bcvChange,
      paraleloChange,
      avgBCV,
      avgParalelo,
      avgBrecha,
      totalRegistros: tasas.length,
    };
  }, [tasas]);

  // Handlers
  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar esta tasa?')) return;
    
    try {
      await db.historialTasas.delete(id);
      success('Tasa eliminada', 'El registro ha sido eliminado exitosamente');
    } catch (err) {
      showError('Error', 'No se pudo eliminar la tasa');
    }
  };

  const handleEdit = (tasa: HistorialTasa) => {
    setEditingTasa(tasa);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingTasa(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('es-VE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleSincronizar = async () => {
    try {
      const resultado = await sincronizar();
      
      // Actualizar contexto global
      actualizarTasas(resultado.tasas);
      
      // Mostrar notificación con comparación
      const { comparacion } = resultado;
      let mensaje = `BCV: Bs. ${resultado.tasas.bcv.toFixed(2)} | Paralelo: Bs. ${resultado.tasas.paralelo.toFixed(2)}`;
      
      if (comparacion.bcv.cambioPorcentaje !== 0) {
        const cambioBCV = comparacion.bcv.cambioPorcentaje;
        const simboloBCV = cambioBCV > 0 ? '↑' : '↓';
        mensaje += `\nBCV ${simboloBCV} ${Math.abs(cambioBCV).toFixed(2)}%`;
      }
      
      if (comparacion.paralelo.cambioPorcentaje !== 0) {
        const cambioPar = comparacion.paralelo.cambioPorcentaje;
        const simboloPar = cambioPar > 0 ? '↑' : '↓';
        mensaje += ` | Paralelo ${simboloPar} ${Math.abs(cambioPar).toFixed(2)}%`;
      }
      
      if (resultado.desdeCache) {
        success('Sincronización completada (Cache)', resultado.mensaje || 'Usando datos en caché');
      } else {
        success('Sincronización exitosa', mensaje);
      }
      
      setMostrarResultadoSync(true);
      setTimeout(() => setMostrarResultadoSync(false), 5000);
    } catch (err: any) {
      showError('Error de sincronización', err.message || 'No se pudo sincronizar con DolarApi');
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/calculadora"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-6 w-6 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <TrendingUp className="h-8 w-8 mr-3 text-blue-600" />
              Gestión de Tasas Cambiarias
            </h1>
            <p className="text-gray-600">
              Administra el historial de tasas BCV y Paralelo
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {/* Botón Sincronizar */}
          <button
            onClick={handleSincronizar}
            disabled={estaCargando}
            className={`inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium transition-colors ${
              estaCargando
                ? 'border-gray-300 text-gray-500 bg-gray-100 cursor-not-allowed'
                : hayConexion()
                ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                : 'border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100'
            }`}
          >
            {estaCargando ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                Sincronizando...
              </>
            ) : (
              <>
                {hayConexion() ? (
                  <Cloud className="h-4 w-4 mr-2" />
                ) : (
                  <WifiOff className="h-4 w-4 mr-2" />
                )}
                Sincronizar API
              </>
            )}
          </button>
          
          <button
            onClick={() => setShowHistorial(!showHistorial)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            {showHistorial ? 'Ocultar Gráfico' : 'Ver Gráfico'}
          </button>
          <button
            onClick={() => {
              setEditingTasa(null);
              setShowForm(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nueva Tasa
          </button>
        </div>
      </div>

      {/* Información de última sincronización */}
      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
        <div className="flex items-center text-sm text-gray-600">
          {hayConexion() ? (
            <Wifi className="h-4 w-4 mr-2 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 mr-2 text-orange-500" />
          )}
          <span>
            {hayConexion() ? 'Conectado a internet' : 'Sin conexión - Usando cache'}
          </span>
          <span className="mx-2">•</span>
          <span>
            Última sincronización: {ultimaSincronizacion ? formatoTiempoTranscurrido() : 'Nunca'}
          </span>
        </div>
        
        {/* Resultado de sincronización */}
        {mostrarResultadoSync && resultado && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center">
              <span className="font-medium text-gray-700">BCV:</span>
              <span className={`ml-1 font-bold ${resultado.comparacion.bcv.cambioPorcentaje > 0 ? 'text-green-600' : resultado.comparacion.bcv.cambioPorcentaje < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                Bs. {resultado.tasas.bcv.toFixed(2)}
                {resultado.comparacion.bcv.cambioPorcentaje !== 0 && (
                  <span className="ml-1 text-xs">
                    ({resultado.comparacion.bcv.cambioPorcentaje > 0 ? '↑' : '↓'} {Math.abs(resultado.comparacion.bcv.cambioPorcentaje).toFixed(2)}%)
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center">
              <span className="font-medium text-gray-700">Paralelo:</span>
              <span className={`ml-1 font-bold ${resultado.comparacion.paralelo.cambioPorcentaje > 0 ? 'text-green-600' : resultado.comparacion.paralelo.cambioPorcentaje < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                Bs. {resultado.tasas.paralelo.toFixed(2)}
                {resultado.comparacion.paralelo.cambioPorcentaje !== 0 && (
                  <span className="ml-1 text-xs">
                    ({resultado.comparacion.paralelo.cambioPorcentaje > 0 ? '↑' : '↓'} {Math.abs(resultado.comparacion.paralelo.cambioPorcentaje).toFixed(2)}%)
                  </span>
                )}
              </span>
            </div>
            {resultado.desdeCache && (
              <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">
                Cache
              </span>
            )}
          </div>
        )}
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Tasa BCV Actual */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Tasa BCV (Hoy)</p>
                <p className="text-2xl font-bold text-gray-900">
                  Bs. {formatCurrency(stats.latest.tasaBCV)}
                </p>
                <div className={`flex items-center mt-1 text-sm ${stats.bcvChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.bcvChange >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                  {stats.bcvChange >= 0 ? '+' : ''}{stats.bcvChange.toFixed(2)}%
                </div>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Tasa Paralelo Actual */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Tasa Paralelo (Hoy)</p>
                <p className="text-2xl font-bold text-gray-900">
                  Bs. {formatCurrency(stats.latest.tasaParalelo)}
                </p>
                <div className={`flex items-center mt-1 text-sm ${stats.paraleloChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.paraleloChange >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                  {stats.paraleloChange >= 0 ? '+' : ''}{stats.paraleloChange.toFixed(2)}%
                </div>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Brecha Actual */}
          <div className={`p-6 rounded-lg shadow-md ${stats.latest.brecha > 5 ? 'bg-red-50' : 'bg-yellow-50'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Brecha Actual</p>
                <p className={`text-2xl font-bold ${stats.latest.brecha > 5 ? 'text-red-600' : 'text-yellow-600'}`}>
                  {stats.latest.brecha.toFixed(2)}%
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Promedio: {stats.avgBrecha.toFixed(2)}%
                </p>
              </div>
              <div className={`p-3 rounded-full ${stats.latest.brecha > 5 ? 'bg-red-100' : 'bg-yellow-100'}`}>
                <AlertCircle className={`h-6 w-6 ${stats.latest.brecha > 5 ? 'text-red-600' : 'text-yellow-600'}`} />
              </div>
            </div>
          </div>

          {/* Total Registros */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Registros</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalRegistros}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  BCV Prom: Bs. {formatCurrency(stats.avgBCV)}
                </p>
              </div>
              <div className="p-3 bg-gray-100 rounded-full">
                <RefreshCcw className="h-6 w-6 text-gray-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gráfico de Historial */}
      {showHistorial && tasas && (
        <HistorialGrafico tasas={tasas.slice(0, 30).reverse()} />
      )}

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setDateFilter('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              dateFilter === 'all' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setDateFilter('today')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              dateFilter === 'today' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Hoy
          </button>
          <button
            onClick={() => setDateFilter('week')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              dateFilter === 'week' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Última Semana
          </button>
          <button
            onClick={() => setDateFilter('month')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              dateFilter === 'month' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Último Mes
          </button>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por fecha o fuente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Tabla de Tasas */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha y Hora
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tasa BCV
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tasa Paralelo
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Brecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fuente
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {!filteredTasas || filteredTasas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium mb-2">No hay tasas registradas</p>
                    <p className="text-sm">Comienza agregando tu primera tasa cambiaria</p>
                  </td>
                </tr>
              ) : (
                filteredTasas.map((tasa) => (
                  <tr key={tasa.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {formatDate(tasa.fecha)}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {tasa.hora}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-medium text-gray-900">
                        Bs. {formatCurrency(tasa.tasaBCV)}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-medium text-gray-900">
                        Bs. {formatCurrency(tasa.tasaParalelo)}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        tasa.brecha > 5 
                          ? 'bg-red-100 text-red-800' 
                          : tasa.brecha > 2 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : 'bg-green-100 text-green-800'
                      }`}>
                        {tasa.brecha.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900">{tasa.fuente || 'Manual'}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleEdit(tasa)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => tasa.id && handleDelete(tasa.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Eliminar"
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

      {/* Modal de Formulario */}
      {showForm && (
        <FormularioTasa
          tasa={editingTasa}
          onClose={() => {
            setShowForm(false);
            setEditingTasa(null);
          }}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
}
