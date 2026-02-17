"use client";

import React from 'react';
import { HistorialTasa } from '@/app/_db/db';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface HistorialGraficoProps {
  tasas: HistorialTasa[];
}

export default function HistorialGrafico({ tasas }: HistorialGraficoProps) {
  // Preparar datos para el gráfico
  const data = React.useMemo(() => {
    return tasas.map(tasa => ({
      fecha: new Date(tasa.fecha).toLocaleDateString('es-VE', {
        month: 'short',
        day: 'numeric',
      }),
      hora: tasa.hora,
      bcv: tasa.tasaBCV,
      paralelo: tasa.tasaParalelo,
      brecha: tasa.brecha,
    }));
  }, [tasas]);

  // Calcular promedios
  const avgBCV = React.useMemo(() => 
    tasas.reduce((sum, t) => sum + t.tasaBCV, 0) / tasas.length,
    [tasas]
  );
  
  const avgParalelo = React.useMemo(() => 
    tasas.reduce((sum, t) => sum + t.tasaParalelo, 0) / tasas.length,
    [tasas]
  );

  const formatCurrency = (value: number) => {
    return `Bs. ${value.toFixed(2)}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Evolución de Tasas (Últimos {tasas.length} registros)
      </h3>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="fecha" 
              stroke="#6b7280"
              fontSize={12}
              tickMargin={10}
            />
            <YAxis 
              stroke="#6b7280"
              fontSize={12}
              tickFormatter={(value) => `Bs.${value}`}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            {/* Línea de promedio BCV */}
            <ReferenceLine 
              y={avgBCV} 
              stroke="#10b981" 
              strokeDasharray="5 5"
              label={{ value: `Prom BCV: ${avgBCV.toFixed(2)}`, fill: '#10b981', fontSize: 12 }}
            />
            
            {/* Línea de promedio Paralelo */}
            <ReferenceLine 
              y={avgParalelo} 
              stroke="#f59e0b" 
              strokeDasharray="5 5"
              label={{ value: `Prom Par: ${avgParalelo.toFixed(2)}`, fill: '#f59e0b', fontSize: 12 }}
            />
            
            <Line
              type="monotone"
              dataKey="bcv"
              name="Tasa BCV"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="paralelo"
              name="Tasa Paralelo"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda adicional */}
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-500 rounded-full mr-2" />
          <span className="text-gray-600">Tasa BCV (Oficial)</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-blue-500 rounded-full mr-2" />
          <span className="text-gray-600">Tasa Paralelo</span>
        </div>
      </div>
    </div>
  );
}
