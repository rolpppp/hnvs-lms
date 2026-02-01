// src/hooks/useStorageWarning.ts
import { useState, useEffect } from 'react';

interface StorageInfo {
  used: number; // in MB
  quota: number; // in MB
  percentage: number;
  isLow: boolean; // < 20% remaining
  isCritical: boolean; // < 10% remaining
}

export function useStorageWarning() {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  const checkStorage = async (): Promise<StorageInfo | null> => {
    if (!navigator.storage || !navigator.storage.estimate) {
      console.warn('Storage API not supported');
      return null;
    }

    try {
      const estimate = await navigator.storage.estimate();
      const used = (estimate.usage || 0) / (1024 * 1024); // Convert to MB
      const quota = (estimate.quota || 0) / (1024 * 1024); // Convert to MB
      const percentage = quota > 0 ? (used / quota) * 100 : 0;
      const remaining = 100 - percentage;

      const info: StorageInfo = {
        used: Math.round(used * 10) / 10,
        quota: Math.round(quota * 10) / 10,
        percentage: Math.round(percentage),
        isLow: remaining < 20,
        isCritical: remaining < 10,
      };

      setStorageInfo(info);
      return info;
    } catch (error) {
      console.error('Failed to check storage:', error);
      return null;
    }
  };

  const canDownload = async (estimatedSizeMB: number): Promise<{ canDownload: boolean; reason?: string }> => {
    const info = await checkStorage();

    if (!info) {
      // If we can't check, allow download (better than blocking)
      return { canDownload: true };
    }

    const available = info.quota - info.used;
    const bufferMB = 50; // Keep at least 50MB free as buffer

    if (available < estimatedSizeMB + bufferMB) {
      return {
        canDownload: false,
        reason: `Not enough storage space. Need ${Math.round(estimatedSizeMB + bufferMB)}MB, but only ${Math.round(available)}MB available.`,
      };
    }

    if (info.isCritical) {
      return {
        canDownload: false,
        reason: 'Storage critically low (< 10% remaining). Please free up space before downloading.',
      };
    }

    if (info.isLow) {
      setShowWarning(true);
      // Allow download but show warning
    }

    return { canDownload: true };
  };

  useEffect(() => {
    // eslint-disable-next-line
    checkStorage();
  }, []);

  return {
    storageInfo,
    showWarning,
    setShowWarning,
    checkStorage,
    canDownload,
  };
}
