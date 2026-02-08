'use client';

import { useEffect } from 'react';
import { initializeSync } from '../_lib/sync';
import { NotificationProvider } from './NotificationProvider';
import SyncStatusBar from './SyncStatusBar';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initializeSync();
  }, []);

  return (
    <NotificationProvider>
      {children}
      <SyncStatusBar />
    </NotificationProvider>
  );
}
