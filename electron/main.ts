import { app, BrowserWindow, ipcMain, Menu, shell, dialog } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

const windows = new Map<string, BrowserWindow>()

type WindowConfig = {
  name: string
  title: string
  width: number
  height: number
  route: string
  minWidth?: number
  minHeight?: number
}

const windowConfigs: WindowConfig[] = [
  { name: 'pending-list', title: '待复核列表', width: 1200, height: 800, route: '/pending-list', minWidth: 1000, minHeight: 700 },
  { name: 'case-detail', title: '病例详情', width: 1280, height: 850, route: '/case-detail', minWidth: 1024, minHeight: 700 },
  { name: 'image-compare', title: '图像对比', width: 1440, height: 900, route: '/image-compare', minWidth: 1200, minHeight: 768 },
  { name: 'diagnosis', title: '诊断建议', width: 1100, height: 800, route: '/diagnosis', minWidth: 900, minHeight: 700 },
  { name: 'report-proof', title: '报告校对', width: 1200, height: 850, route: '/report-proof', minWidth: 1000, minHeight: 700 },
  { name: 'qc-score', title: '质控评分', width: 1180, height: 850, route: '/qc-score', minWidth: 980, minHeight: 700 },
  { name: 'statistics', title: '统计汇总', width: 1400, height: 900, route: '/statistics', minWidth: 1180, minHeight: 768 }
]

function createWindow(config: WindowConfig, query?: Record<string, string>) {
  const queryStr = query
    ? '?' + new URLSearchParams(query).toString()
    : ''
  const titleSuffix = (query?.caseNo && query?.patientName)
    ? ` · ${query.caseNo} ${query.patientName}`
    : (query?.caseId ? ` · 病例 ${query.caseId}` : '')

  if (windows.has(config.name)) {
    const win = windows.get(config.name)!
    if (win.isMinimized()) win.restore()
    win.focus()

    win.setTitle(config.title + titleSuffix)

    if (VITE_DEV_SERVER_URL) {
      const targetURL = VITE_DEV_SERVER_URL + '/#' + config.route + queryStr
      try {
        win.webContents.send('switch-case', query || {})
        setTimeout(() => {
          if (!win.isDestroyed()) win.loadURL(targetURL)
        }, 30)
      } catch {
        win.loadURL(targetURL)
      }
    } else {
      try {
        win.webContents.send('switch-case', query || {})
      } catch {}
    }
    return win
  }

  const win = new BrowserWindow({
    title: config.title + titleSuffix,
    width: config.width,
    height: config.height,
    minWidth: config.minWidth || 800,
    minHeight: config.minHeight || 600,
    icon: path.join(process.env.VITE_PUBLIC!, 'favicon.ico'),
    backgroundColor: '#f0f2f5',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  })

  windows.set(config.name, win)

  win.on('closed', () => {
    windows.delete(config.name)
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL + '/#' + config.route + queryStr)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'), {
      hash: config.route
    })
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  return win
}

function createAppMenu() {
  const template = [
    {
      label: '窗口',
      submenu: windowConfigs.map(cfg => ({
        label: cfg.title,
        click: () => createWindow(cfg)
      }))
    },
    {
      label: '工具',
      submenu: [
        {
          label: '重新加载',
          accelerator: 'F5',
          click: (_, win) => (win as Electron.BrowserWindow | undefined)?.reload()
        },
        {
          label: '开发者工具',
          accelerator: 'F12',
          click: (_, win) => (win as Electron.BrowserWindow | undefined)?.webContents.toggleDevTools()
        }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: '关于',
              message: '消化内镜辅助诊疗质控复核系统',
              detail: `版本: ${app.getVersion()}\n适用于内镜中心质控医生院内病例复核工作`
            })
          }
        }
      ]
    }
  ] as Electron.MenuItemConstructorOptions[]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(() => {
  createAppMenu()
  createWindow(windowConfigs[0])

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(windowConfigs[0])
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('open-window', (_, name: string, query?: Record<string, string>) => {
  const config = windowConfigs.find(c => c.name === name)
  if (config) {
    return createWindow(config, query) !== undefined
  }
  return false
})

ipcMain.handle('close-window', (_, name: string) => {
  const win = windows.get(name)
  if (win) {
    win.close()
    return true
  }
  return false
})

ipcMain.handle('get-open-windows', () => {
  return Array.from(windows.keys())
})

ipcMain.handle('export-dialog', async () => {
  const result = await dialog.showSaveDialog({
    filters: [
      { name: 'Excel 文件', extensions: ['xlsx'] },
      { name: 'CSV 文件', extensions: ['csv'] }
    ],
    defaultPath: `复核清单_${new Date().toISOString().slice(0, 10)}.xlsx`
  })
  return result
})
