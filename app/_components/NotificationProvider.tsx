'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { TOKENS } from './_pmTheme';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  success: (title: string, message?: string, duration?: number) => void;
  error: (title: string, message?: string, duration?: number) => void;
  warning: (title: string, message?: string, duration?: number) => void;
  info: (title: string, message?: string, duration?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback(
    (notification: Omit<Notification, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newNotification = { ...notification, id };

      setNotifications((prev) => [...prev, newNotification]);

      if (notification.duration !== 0) {
        setTimeout(() => {
          removeNotification(id);
        }, notification.duration || 5000);
      }
    },
    [removeNotification],
  );

  const success = useCallback(
    (title: string, message?: string, duration?: number) => {
      addNotification({ type: 'success', title, message: message || '', duration });
    },
    [addNotification],
  );

  const error = useCallback(
    (title: string, message?: string, duration?: number) => {
      addNotification({ type: 'error', title, message: message || '', duration });
    },
    [addNotification],
  );

  const warning = useCallback(
    (title: string, message?: string, duration?: number) => {
      addNotification({ type: 'warning', title, message: message || '', duration });
    },
    [addNotification],
  );

  const info = useCallback(
    (title: string, message?: string, duration?: number) => {
      addNotification({ type: 'info', title, message: message || '', duration });
    },
    [addNotification],
  );

  return (
    <NotificationContext.Provider
      value={{ notifications, addNotification, removeNotification, success, error, warning, info }}
    >
      {children}
      <NotificationContainer notifications={notifications} onRemove={removeNotification} />
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

function NotificationContainer({
  notifications,
  onRemove,
}: {
  notifications: Notification[];
  onRemove: (id: string) => void;
}) {
  const getMeta = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          color: TOKENS.green,
          bg: TOKENS.greenSoft,
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          color: TOKENS.red,
          bg: TOKENS.redSoft,
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-4 h-4" />,
          color: TOKENS.amber,
          bg: TOKENS.amberSoft,
        };
      case 'info':
        return {
          icon: <Info className="w-4 h-4" />,
          color: TOKENS.charcoal,
          bg: TOKENS.slate100,
        };
    }
  };

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-sm">
      {notifications.map((notification) => {
        const meta = getMeta(notification.type);
        return (
          <div
            key={notification.id}
            className="flex items-start gap-3 p-3 rounded pm-elevated"
            style={{
              background: '#fff',
              border: `1px solid ${TOKENS.slate200}`,
              borderLeft: `3px solid ${meta.color}`,
            }}
            role="alert"
          >
            <div
              className="flex items-center justify-center h-7 w-7 rounded shrink-0"
              style={{ background: meta.bg, color: meta.color }}
            >
              {meta.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h4
                className="text-[13px] font-bold"
                style={{ color: TOKENS.charcoal }}
              >
                {notification.title}
              </h4>
              {notification.message && (
                <p
                  className="text-[12px] mt-0.5"
                  style={{ color: TOKENS.slate500 }}
                >
                  {notification.message}
                </p>
              )}
            </div>
            <button
              onClick={() => onRemove(notification.id)}
              className="shrink-0 transition-colors"
              style={{ color: TOKENS.slate400 }}
              aria-label="Cerrar notificación"
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color = TOKENS.charcoal)
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color = TOKENS.slate400)
              }
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default NotificationProvider;
