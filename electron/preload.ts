import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openWindow: (name: string, query?: Record<string, string>) =>
    ipcRenderer.invoke('open-window', name, query),
  closeWindow: (name: string) => ipcRenderer.invoke('close-window', name),
  getOpenWindows: () => ipcRenderer.invoke('get-open-windows'),
  showExportDialog: () => ipcRenderer.invoke('export-dialog')
})

export type ElectronAPI = {
  openWindow: (name: string, query?: Record<string, string>) => Promise<boolean>
  closeWindow: (name: string) => Promise<boolean>
  getOpenWindows: () => Promise<string[]>
  showExportDialog: () => Promise<{ filePath?: string; canceled: boolean }>
}
