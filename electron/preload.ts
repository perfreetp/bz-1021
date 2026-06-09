import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openWindow: (name: string, query?: Record<string, string>) =>
    ipcRenderer.invoke('open-window', name, query),
  closeWindow: (name: string) => ipcRenderer.invoke('close-window', name),
  getOpenWindows: () => ipcRenderer.invoke('get-open-windows'),
  showExportDialog: () => ipcRenderer.invoke('export-dialog'),
  onSwitchCase: (callback: (query: Record<string, string>) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, query: Record<string, string>) => callback(query)
    ipcRenderer.on('switch-case', listener)
    return () => ipcRenderer.removeListener('switch-case', listener)
  }
})

export type ElectronAPI = {
  openWindow: (name: string, query?: Record<string, string>) => Promise<boolean>
  closeWindow: (name: string) => Promise<boolean>
  getOpenWindows: () => Promise<string[]>
  showExportDialog: () => Promise<{ filePath?: string; canceled: boolean }>
  onSwitchCase: (callback: (query: Record<string, string>) => void) => () => void
}
