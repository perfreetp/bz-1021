"use strict";const e=require("electron");e.contextBridge.exposeInMainWorld("electronAPI",{openWindow:(o,n)=>e.ipcRenderer.invoke("open-window",o,n),closeWindow:o=>e.ipcRenderer.invoke("close-window",o),getOpenWindows:()=>e.ipcRenderer.invoke("get-open-windows"),showExportDialog:()=>e.ipcRenderer.invoke("export-dialog")});
//# sourceMappingURL=preload.js.map
