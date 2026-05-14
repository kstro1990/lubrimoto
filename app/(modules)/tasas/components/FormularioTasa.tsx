"use client";

import React, { useState } from 'react';
import { X, Save, TrendingUp, AlertCircle } from 'lucide-react';
import { db, HistorialTasa } from '@/app/_db/db';
import { useNotifications } from '@/app/_components/NotificationProvider';
import { PMScope, TOKENS, PMBtnPrimary, PMBtnSecondary } from '@/app/_components/_pmTheme';

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
    tasaBCV: tasa?.tasaBCV || 36.5,
    tasaParalelo: tasa?.tasaParalelo || 38.2,
    fuente: tasa?.fuente || 'Manual',
    fecha: tasa
      ? new Date(tasa.fecha).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    hora:
      tasa?.hora ||
      new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
  });

  const brecha = React.useMemo(() => {
    if (formData.tasaBCV === 0) return 0;
    return ((formData.tasaParalelo - formData.tasaBCV) / formData.tasaBCV) * 100;
  }, [formData.tasaBCV, formData.tasaParalelo]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (formData.tasaBCV <= 0) newErrors.tasaBCV = 'La tasa BCV debe ser mayor a 0';
    if (formData.tasaParalelo <= 0)
      newErrors.tasaParalelo = 'La tasa paralelo debe ser mayor a 0';
    if (formData.tasaParalelo < formData.tasaBCV)
      newErrors.tasaParalelo = 'La tasa paralelo no puede ser menor que la tasa BCV';
    if (!formData.fecha) newErrors.fecha = 'La fecha es requerida';
    if (!formData.hora) newErrors.hora = 'La hora es requerida';
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
        await db.historialTasas.update(tasa.id, tasaData);
        success('Tasa actualizada', 'El registro ha sido actualizado exitosamente');
      } else {
        await db.historialTasas.add(tasaData);
        success('Tasa registrada', 'La nueva tasa ha sido guardada exitosamente');
      }

      onSuccess();
    } catch {
      showError('Error', 'No se pudo guardar la tasa');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === 'tasaBCV' || name === 'tasaParalelo' ? parseFloat(value) || 0 : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const fieldErr = (n: string) => (errors[n] ? 'pm-input pm-input-error' : 'pm-input');

  const high = brecha > 5;

  return (
    <PMScope className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="fixed inset-0"
          style={{ background: 'rgba(18, 24, 38, 0.55)' }}
          onClick={onClose}
        />

        <div
          className="relative overflow-hidden rounded w-full max-w-lg pm-elevated"
          style={{ background: '#fff', border: `1px solid ${TOKENS.slate200}` }}
        >
          {/* Header */}
          <div
            className="px-5 py-3 flex justify-between items-center"
            style={{
              background: TOKENS.slate50,
              borderBottom: `1px solid ${TOKENS.slate200}`,
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="flex items-center justify-center h-8 w-8 rounded"
                style={{ background: TOKENS.charcoal, color: '#fff' }}
              >
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <div className="pm-eyebrow">
                  {tasa ? 'Editar registro' : 'Nuevo registro'}
                </div>
                <h3
                  className="text-[16px] font-semibold leading-5"
                  style={{ color: TOKENS.charcoal }}
                >
                  {tasa ? 'Editar Tasa' : 'Nueva Tasa Cambiaria'}
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center h-8 w-8 rounded transition-colors"
              style={{ color: TOKENS.slate500 }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = TOKENS.slate100)
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')
              }
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4" style={{ background: TOKENS.bg }}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="pm-label">
                  Tasa BCV <span style={{ color: TOKENS.red }}>*</span>
                </label>
                <div className="relative">
                  <span
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] font-bold pointer-events-none"
                    style={{ color: TOKENS.slate500 }}
                  >
                    Bs.
                  </span>
                  <input
                    type="number"
                    name="tasaBCV"
                    value={formData.tasaBCV}
                    onChange={handleChange}
                    step="0.01"
                    min="0.01"
                    className={`${fieldErr('tasaBCV')} pm-tnum`}
                    style={{ paddingLeft: '2.5rem' }}
                    placeholder="36.50"
                  />
                </div>
                {errors.tasaBCV && <p className="pm-error">{errors.tasaBCV}</p>}
              </div>

              <div>
                <label className="pm-label">
                  Tasa Paralelo <span style={{ color: TOKENS.red }}>*</span>
                </label>
                <div className="relative">
                  <span
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] font-bold pointer-events-none"
                    style={{ color: TOKENS.slate500 }}
                  >
                    Bs.
                  </span>
                  <input
                    type="number"
                    name="tasaParalelo"
                    value={formData.tasaParalelo}
                    onChange={handleChange}
                    step="0.01"
                    min="0.01"
                    className={`${fieldErr('tasaParalelo')} pm-tnum`}
                    style={{ paddingLeft: '2.5rem' }}
                    placeholder="38.20"
                  />
                </div>
                {errors.tasaParalelo && <p className="pm-error">{errors.tasaParalelo}</p>}
              </div>
            </div>

            {/* Brecha calculada */}
            <div
              className="rounded px-3 py-2.5 flex items-center justify-between"
              style={{
                background: '#fff',
                border: `1px solid ${TOKENS.slate200}`,
                borderLeft: `3px solid ${high ? TOKENS.red : TOKENS.green}`,
              }}
            >
              <div>
                <div className="pm-eyebrow">Brecha calculada</div>
                <div
                  className="pm-tnum font-bold text-[18px]"
                  style={{ color: high ? TOKENS.red : TOKENS.green }}
                >
                  {brecha.toFixed(2)}%
                </div>
              </div>
              {high && (
                <div
                  className="text-[12px] flex items-center gap-1"
                  style={{ color: TOKENS.red }}
                >
                  <AlertCircle className="h-4 w-4" />
                  Brecha alta · revisar tasas
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="pm-label">
                  Fecha <span style={{ color: TOKENS.red }}>*</span>
                </label>
                <input
                  type="date"
                  name="fecha"
                  value={formData.fecha}
                  onChange={handleChange}
                  className={fieldErr('fecha')}
                />
                {errors.fecha && <p className="pm-error">{errors.fecha}</p>}
              </div>

              <div>
                <label className="pm-label">
                  Hora <span style={{ color: TOKENS.red }}>*</span>
                </label>
                <input
                  type="time"
                  name="hora"
                  value={formData.hora}
                  onChange={handleChange}
                  className={fieldErr('hora')}
                />
                {errors.hora && <p className="pm-error">{errors.hora}</p>}
              </div>
            </div>

            <div>
              <label className="pm-label">Fuente</label>
              <select
                name="fuente"
                value={formData.fuente}
                onChange={handleChange}
                className="pm-input"
              >
                <option value="Manual">Manual</option>
                <option value="BCV">BCV Oficial</option>
                <option value="Paralelo">Mercado Paralelo</option>
                <option value="AirTM">AirTM</option>
                <option value="Monitor Dolar">Monitor Dolar</option>
                <option value="LocalBitcoins">LocalBitcoins</option>
              </select>
            </div>

            <div
              className="flex justify-end gap-2 pt-3"
              style={{ borderTop: `1px solid ${TOKENS.slate200}` }}
            >
              <PMBtnSecondary type="button" onClick={onClose}>
                Cancelar
              </PMBtnSecondary>
              <PMBtnPrimary type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <span
                      className="inline-block w-3.5 h-3.5 rounded-full animate-spin"
                      style={{
                        border: '2px solid rgba(255,255,255,0.4)',
                        borderTopColor: '#fff',
                      }}
                    />
                    Guardando…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {tasa ? 'Actualizar' : 'Guardar'}
                  </>
                )}
              </PMBtnPrimary>
            </div>
          </form>
        </div>
      </div>
    </PMScope>
  );
}
