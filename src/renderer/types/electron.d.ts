/**
 * Type declarations for Electron API exposed via preload
 */

export interface ElectronAPI {
  showNotification: (title: string, body: string) => Promise<void>;
  getAppVersion: () => Promise<string>;
  minimizeToTray: () => Promise<void>;
  quitApp: () => Promise<void>;
  platform: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
