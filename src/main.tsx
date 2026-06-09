import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import 'dayjs/locale/zh-cn'
import PendingListPage from './pages/PendingListPage'
import CaseDetailPage from './pages/CaseDetailPage'
import ImageComparePage from './pages/ImageComparePage'
import DiagnosisPage from './pages/DiagnosisPage'
import ReportProofPage from './pages/ReportProofPage'
import QCScorePage from './pages/QCScorePage'
import StatisticsPage from './pages/StatisticsPage'
import './styles/global.less'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif'
        }
      }}
    >
      <AntdApp>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/pending-list" replace />} />
            <Route path="/pending-list" element={<PendingListPage />} />
            <Route path="/case-detail" element={<CaseDetailPage />} />
            <Route path="/image-compare" element={<ImageComparePage />} />
            <Route path="/diagnosis" element={<DiagnosisPage />} />
            <Route path="/report-proof" element={<ReportProofPage />} />
            <Route path="/qc-score" element={<QCScorePage />} />
            <Route path="/statistics" element={<StatisticsPage />} />
            <Route path="*" element={<Navigate to="/pending-list" replace />} />
          </Routes>
        </HashRouter>
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>
)
