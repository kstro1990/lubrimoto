'use client';

import { useEffect } from 'react';
import { initializeSync } from '../_lib/sync';
import { NotificationProvider } from './NotificationProvider';
import { TasasProvider } from '../_contexts/TasasContext';
import SyncStatusBar from './SyncStatusBar';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initializeSync();
  }, []);

  return (
    <NotificationProvider>
      <TasasProvider>
        {children}
        <SyncStatusBar />
      </TasasProvider>
    </NotificationProvider>
  );
}
