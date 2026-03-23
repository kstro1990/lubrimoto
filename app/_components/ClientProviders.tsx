'use client';

import { useEffect } from 'react';
import { initializeSync } from '../_lib/sync';
import { NotificationProvider } from './NotificationProvider';
import { TasasProvider } from '../_contexts/TasasContext';
import SyncStatusBar from './SyncStatusBar';
import ThemeToggle from './ui/ThemeToggle';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initializeSync();
  }, []);

  return (
    <NotificationProvider>
      <TasasProvider>
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          <ThemeToggle />
        </div>
        {children}
        <SyncStatusBar />
      </TasasProvider>
    </NotificationProvider>
  );
}
