"use client";

import React, { useState, useEffect } from 'react';
import { X, Save, TrendingUp, AlertCircle } from 'lucide-react';
import { db, HistorialTasa } from '@/app/_db/db';
import { useNotifications } from '@/app/_components/NotificationProvider';

interface FormularioTasaProps {
  tasa?: HistorialTasa | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function FormularioTasa({ tasa, onClose, onSuccess }: FormularioTasaProps) {
  const { success, error: showError } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    tasaBCV: tasa?.tasaBCV || 36.50,
    tasaParalelo: tasa?.tasaParalelo || 38.20,
    fuente: tasa?.fuente || 'Manual',
    fecha: tasa ? new Date(tasa.fecha).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    hora: tasa?.hora || new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
  });

  // Calcular brecha en tiempo real
  const brecha = React.useMemo(() => {
    if (formData.tasaBCV === 0) return 0;
    return ((formData.tasaParalelo - formData.tasaBCV) / formData.tasaBCV) * 100;
  }, [formData.tasaBCV, formData.tasaParalelo]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (formData.tasaBCV <= 0) {
      newErrors.tasaBCV = 'La tasa BCV debe ser mayor a 0';
    }
    
    if (formData.tasaParalelo <= 0) {
      newErrors.tasaParalelo = 'La tasa paralelo debe ser mayor a 0';
    }
    
    if (formData.tasaParalelo < formData.tasaBCV) {
      newErrors.tasaParalelo = 'La tasa paralelo no puede ser menor que la tasa BCV';
    }
    
    if (!formData.fecha) {
      newErrors.fecha = 'La fecha es requerida';
    }
    
    if (!formData.hora) {
      newErrors.hora = 'La hora es requerida';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      const tasaData = {
        tasaBCV: formData.tasaBCV,
        tasaParalelo: formData.tasaParalelo,
        brecha,
        fecha: new Date(formData.fecha),
        hora: formData.hora,
        fuente: formData.fuente || 'Manual',
        createdAt: new Date(),
      };
      
      if (tasa?.id) {
        // Actualizar existente
        await db.historialTasas.update(tasa.id, tasaData);
        success('Tasa actualizada', 'El registro ha sido actualizado exitosamente');
      } else {
        // Crear nuevo
        await db.historialTasas.add(tasaData);
        success('Tasa registrada', 'La nueva tasa ha sido guardada exitosamente');
      }
      
      onSuccess();
    } catch (err) {
      showError('Error', 'No se pudo guardar la tasa');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'tasaBCV' || name === 'tasaParalelo' 
        ? parseFloat(value) || 0 
        : value,
    }));
    
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />
        
        {/* Modal */}
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all w-full max-w-lg">
          {/* Header */}
          <div className="bg-blue-600 px-4 py-3 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              {tasa ? 'Editar Tasa' : 'Nueva Tasa Cambiaria'}
            </h3>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Tasas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tasa BCV <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    Bs.
                  </span>
                  <input
                    type="number"
                    name="tasaBCV"
                    value={formData.tasaBCV}
                    onChange={handleChange}
                    step="0.01"
                    min="0.01"
                    className={`w-full pl-10 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.tasaBCV ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="36.50"
                  />
                </div>
                {errors.tasaBCV && (
                  <p className="mt-1 text-sm text-red-600">{errors.tasaBCV}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tasa Paralelo <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    Bs.
                  </span>
                  <input
                    type="number"
                    name="tasaParalelo"
                    value={formData.tasaParalelo}
                    onChange={handleChange}
                    step="0.01"
                    min="0.01"
                    className={`w-full pl-10 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.tasaParalelo ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="38.20"
                  />
                </div>
                {errors.tasaParalelo && (
                  <p className="mt-1 text-sm text-red-600">{errors.tasaParalelo}</p>
                )}
              </div>
            </div>

            {/* Brecha Calculada */}
            <div className={`p-3 rounded-md ${brecha > 5 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Brecha Calculada:</span>
                <span className={`text-lg font-bold ${brecha > 5 ? 'text-red-600' : 'text-green-600'}`}>
                  {brecha.toFixed(2)}%
                </span>
              </div>
              {brecha > 5 && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Brecha alta - revisar tasas
                </p>
              )}
            </div>

            {/* Fecha y Hora */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="fecha"
                  value={formData.fecha}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.fecha ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.fecha && (
                  <p className="mt-1 text-sm text-red-600">{errors.fecha}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hora <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  name="hora"
                  value={formData.hora}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.hora ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.hora && (
                  <p className="mt-1 text-sm text-red-600">{errors.hora}</p>
                )}
              </div>
            </div>

            {/* Fuente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fuente
              </label>
              <select
                name="fuente"
                value={formData.fuente}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Manual">Manual</option>
                <option value="BCV">BCV Oficial</option>
                <option value="Paralelo">Mercado Paralelo</option>
                <option value="AirTM">AirTM</option>
                <option value="Monitor Dolar">Monitor Dolar</option>
                <option value="LocalBitcoins">LocalBitcoins</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {tasa ? 'Actualizar' : 'Guardar'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
