// Local storage service for UI settings only - Nostr data goes to IndexedDB
import { AppSettings } from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'tagstr_settings'
} as const;

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'wireframe',
  autoRefresh: true,
  refreshInterval: 30000, // 30 seconds
  maxEvents: 1000,
  defaultSort: 'count',
  relaySettings: {
    autoDiscover: true,
    maxRelays: 999999, // No connection cap
    timeout: 5000,
    minTrustScore: 2,
    trustDecayHours: 168,
    discoveryInterval: 30000
  }
};

class StorageService {
  // Settings (UI only)
  getSettings(): AppSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.warn('Failed to load settings from storage:', error);
    }
    return DEFAULT_SETTINGS;
  }

  saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  // Export/Import settings only
  exportSettings(): AppSettings {
    return this.getSettings();
  }

  importSettings(settings: AppSettings): void {
    try {
      this.saveSettings(settings);
      console.log('Settings imported successfully');
    } catch (error) {
      console.error('Failed to import settings:', error);
      throw error;
    }
  }

  // Clear settings
  clearSettings(): void {
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    console.log('Settings cleared');
  }

  // Storage info for settings only
  getStorageInfo(): {
    used: number;
    available: number;
    quota: number;
    percentage: number;
  } {
    let used = 0;
    let quota = 0;
    
    try {
      // Calculate used space for settings only
      const settingsData = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (settingsData) {
        used = settingsData.length * 2; // Rough UTF-16 byte estimate
      }
      
      // Estimate quota (usually 5-10MB for localStorage)
      quota = 10 * 1024 * 1024; // 10MB estimate
      
      return {
        used,
        available: quota - used,
        quota,
        percentage: (used / quota) * 100
      };
    } catch (error) {
      return {
        used: 0,
        available: 0,
        quota: 0,
        percentage: 0
      };
    }
  }
}

export const storageService = new StorageService();