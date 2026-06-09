import React, { useEffect } from 'react'
import { Space, Button, Tooltip, App } from 'antd'
import {
  UnorderedListOutlined,
  FileTextOutlined,
  PictureOutlined,
  BulbOutlined,
  AuditOutlined,
  TrophyOutlined,
  BarChartOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import type { PropsWithChildren } from 'react'
import { useAppStore } from '../store/useAppStore'
import './PageLayout.less'

const windowNavItems = [
  { key: 'pending-list', label: '待复核列表', icon: <UnorderedListOutlined />, desc: '查看所有待复核病例，可按条件筛选' },
  { key: 'case-detail', label: '病例详情', icon: <FileTextOutlined />, desc: '查看病例基本信息、检查过程关键帧' },
  { key: 'image-compare', label: '图像对比', icon: <PictureOutlined />, desc: '并排对比历史影像，标注病灶' },
  { key: 'diagnosis', label: '诊断建议', icon: <BulbOutlined />, desc: '补充病灶分级，检查取材完整性' },
  { key: 'report-proof', label: '报告校对', icon: <AuditOutlined />, desc: '检查报告术语，核对活检瓶编号' },
  { key: 'qc-score', label: '质控评分', icon: <TrophyOutlined />, desc: '按规则计算质控分，给出复核意见' },
  { key: 'statistics', label: '统计汇总', icon: <BarChartOutlined />, desc: '查看医生趋势，生成月度汇总' }
]

declare global {
  interface Window {
    electronAPI?: {
      openWindow: (name: string, query?: Record<string, string>) => Promise<boolean>
      closeWindow: (name: string) => Promise<boolean>
      getOpenWindows: () => Promise<string[]>
      showExportDialog: () => Promise<{ filePath?: string; canceled: boolean }>
      onSwitchCase?: (cb: (q: Record<string, string>) => void) => () => void
    }
  }
}

export const openWindow = async (name: string, query?: Record<string, string>) => {
  if (window.electronAPI?.openWindow) {
    await window.electronAPI.openWindow(name, query)
  } else {
    const basePath = '/#' + (name.startsWith('/') ? name : '/' + name)
    const search = query ? '?' + new URLSearchParams(query).toString() : ''
    window.open(basePath + search, '_blank', 'width=1200,height=800')
  }
}

export const getQueryParams = (): Record<string, string> => {
  const hashSearch = window.location.hash.split('?')[1] || ''
  const urlSearch = window.location.search.slice(1) || ''
  const search = hashSearch || urlSearch
  const params = new URLSearchParams(search)
  const result: Record<string, string> = {}
  params.forEach((v, k) => { result[k] = v })
  return result
}

interface PageLayoutProps extends PropsWithChildren {
  title: string
  currentKey: string
  subtitle?: string
  extra?: React.ReactNode
}

const PageLayout: React.FC<PageLayoutProps> = ({ title, currentKey, subtitle, extra, children }) => {
  const { message } = App.useApp()
  const { currentCaseId, setCurrentCase, cases } = useAppStore()

  useEffect(() => {
    const params = getQueryParams()
    if (params.caseId && (!currentCaseId || currentCaseId !== params.caseId)) {
      setCurrentCase(params.caseId, false)
    }
    if (window.electronAPI?.onSwitchCase) {
      const off = window.electronAPI.onSwitchCase((q) => {
        if (q?.caseId && q.caseId !== useAppStore.getState().currentCaseId) {
          useAppStore.getState().setCurrentCase(q.caseId, true)
        }
      })
      return off
    }
  }, [])

  const handleNavClick = async (key: string) => {
    if (key === currentKey) return
    const params = getQueryParams()
    const state = useAppStore.getState()
    const case_ = state.currentCaseId ? state.cases.find(c => c.id === state.currentCaseId) : undefined
    const query: Record<string, string> = {}
    if (params.caseId || case_) {
      const cid = params.caseId || case_?.id!
      query.caseId = cid
      if (case_) { query.caseNo = case_.caseNo; query.patientName = case_.patient.name }
    }
    await openWindow(key, Object.keys(query).length ? query : undefined)
    message.info(`已打开【${windowNavItems.find(i => i.key === key)?.label}】窗口`)
  }

  const handleRefresh = () => window.location.reload()

  const currentCase = currentCaseId ? cases.find(c => c.id === currentCaseId) : undefined
  const displaySubtitle = (currentCase && currentKey !== 'pending-list' && currentKey !== 'statistics')
    ? `${currentCase.caseNo} · ${currentCase.patient.name} · ${currentCase.patient.gender} ${currentCase.patient.age}岁${subtitle ? ' | ' + subtitle : ''}`
    : subtitle

  return (
    <div className="page-layout">
      <header className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{title}</h1>
          {displaySubtitle && <div className="page-subtitle">{displaySubtitle}</div>}
        </div>
        <div className="page-header-right">
          {extra}
          <Tooltip title="刷新">
            <Button icon={<ReloadOutlined />} onClick={handleRefresh} />
          </Tooltip>
        </div>
      </header>

      <nav className="page-nav">
        <Space wrap size={[8, 8]}>
          {windowNavItems.map(item => (
            <Tooltip key={item.key} title={item.desc}>
              <Button
                type={item.key === currentKey ? 'primary' : 'default'}
                icon={item.icon}
                onClick={() => handleNavClick(item.key)}
                className={`nav-btn ${item.key === currentKey ? 'nav-btn-active' : ''}`}
              >
                {item.label}
              </Button>
            </Tooltip>
          ))}
        </Space>
      </nav>

      <main className="page-content">
        {children}
      </main>
    </div>
  )
}

export default PageLayout
