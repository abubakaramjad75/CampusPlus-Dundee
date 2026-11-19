import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const OfflineIndicator: React.FC = () => {
  const { isOnline, pendingOfflineCount } = useApp();

  if (isOnline && pendingOfflineCount === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 text-xs px-4 py-2"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {!isOnline ? (
            <WifiOff className="w-4 h-4 shrink-0" />
          ) : (
            <RefreshCw className="w-4 h-4 shrink-0" />
          )}
          <span>
            {!isOnline
              ? 'Offline Mode — Showing cached Dundee City Campus locations and study data.'
              : `${pendingOfflineCount} offline submission(s) waiting to sync.`}
          </span>
        </div>
      </div>
    </div>
  );
};
