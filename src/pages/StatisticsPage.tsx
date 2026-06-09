import React, { useEffect, useMemo, useState } from 'react'
import {
  Row, Col, Card, Tag, Button, Space, Select, DatePicker,
  Tabs, Table, Statistic, Progress, App, Tooltip, Divider,
  List, Dropdown, Modal, Radio, Form, InputNumber, Descriptions,
  Drawer, Empty
} from 'antd'
import {
  BarChartOutlined, TrophyOutlined, UserOutlined,
  DownloadOutlined, WarningOutlined, FileExcelOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined,
  LineChartOutlined, PieChartOutlined, ArrowUpOutlined, ArrowDownOutlined,
  CalendarOutlined, TeamOutlined, FileTextOutlined, PrinterOutlined
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import PageLayout, { openWindow } from '../components/PageLayout'
import { useAppStore, doctors, qcRules } from '../store/useAppStore'
import type { DoctorStats, MonthlySummary, CaseRecord, CaseStatus } from '../types'

const { RangePicker } = DatePicker

const StatisticsPage: React.FC = () => {
  const { message } = App.useApp()
  const { doctorStats, monthlySummary, cases, filterStatsCases } = useAppStore()
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | 'all'>('all')
  const [tabKey, setTabKey] = useState('overview')
  const [months, setMonths] = useState(6)
  const [detailDrawer, setDetailDrawer] = useState<{
    open: boolean
    title: string
    query: { doctorId?: string; month?: string; issueType?: string }
    cases: CaseRecord[]
  }>({
    open: false,
    title: '',
    query: {},
    cases: []
  })

  const openDrawer = (params: {
    doctorId?: string
    month?: string
    issueType?: string
    title: string
  }) => {
    const query = {
      doctorId: params.doctorId,
      month: params.month,
      issueType: params.issueType
    }
    const filteredCases = filterStatsCases(query)
    setDetailDrawer({
      open: true,
      title: params.title,
      query,
      cases: filteredCases
    })
  }

  const closeDrawer = () => {
    setDetailDrawer(prev => ({ ...prev, open: false }))
  }

  const filteredDoctorStats = useMemo(
    () => selectedDoctorId === 'all' ? doctorStats : doctorStats.filter(d => d.doctorId === selectedDoctorId),
    [doctorStats, selectedDoctorId]
  )

  const overallStats = useMemo(() => {
    const total = cases.length
    const pending = cases.filter(c => c.status === '待复核').length
    const reviewing = cases.filter(c => c.status === '复核中').length
    const passed = cases.filter(c => c.status === '已通过').length
    const returned = cases.filter(c => c.status === '已退回').length
    const disputed = cases.filter(c => c.status === '争议中').length
    const reviewed = total - pending - reviewing
    const passRate = reviewed ? passed / reviewed : 0
    const returnRate = reviewed ? returned / reviewed : 0
    const avgScore = reviewed
      ? cases.filter(c => c.status !== '待复核' && c.status !== '复核中').reduce((s, c) => s + c.qcTotalScore, 0) / reviewed
      : 0

    const totalLesions = cases.reduce((s, c) => s + c.lesions.length, 0)
    const totalBiopsy = cases.reduce((s, c) => s + c.biopsy.length, 0)
    const totalIssues = cases.reduce((s, c) => s + c.reportIssues.length, 0)
    const polypCount = cases.reduce((s, c) => s + c.lesions.filter(l => l.type === '息肉').length, 0)

    return {
      total, pending, reviewing, passed, returned, disputed, reviewed,
      passRate, returnRate, avgScore,
      totalLesions, totalBiopsy, totalIssues, polypCount
    }
  }, [cases])

  const scoreTrendOption = useMemo(() => {
    const ms = monthlySummary.slice(-months)
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['平均质控分', '通过率%'] },
      grid: { left: 40, right: 50, top: 40, bottom: 30 },
      xAxis: { type: 'category', data: ms.map(m => m.month) },
      yAxis: [
        { type: 'value', min: 50, max: 100, name: '质控分', axisLabel: { formatter: '{value}' } },
        { type: 'value', min: 0, max: 100, name: '通过率%', axisLabel: { formatter: '{value}%' } }
      ],
      series: [
        {
          name: '平均质控分',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 10,
          data: ms.map(m => m.avgScore.toFixed(1)),
          itemStyle: { color: '#1677ff' },
          areaStyle: { color: 'rgba(22, 119, 255, 0.15)' },
          label: { show: true, position: 'top' }
        },
        {
          name: '通过率%',
          type: 'bar',
          yAxisIndex: 1,
          data: ms.map(m => (m.passRate * 100).toFixed(0)),
          itemStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: '#52c41a' },
                { offset: 1, color: '#95de64' }
              ]
            },
            borderRadius: [4, 4, 0, 0]
          },
          label: { show: true, position: 'top', formatter: '{c}%' }
        }
      ]
    }
  }, [monthlySummary, months])

  const caseVolumeOption = useMemo(() => {
    const ms = monthlySummary.slice(-months)
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['总病例', '已复核', '退回', '争议'] },
      grid: { left: 40, right: 20, top: 40, bottom: 30 },
      xAxis: { type: 'category', data: ms.map(m => m.month) },
      yAxis: { type: 'value' },
      series: [
        { name: '总病例', type: 'bar', stack: 't', data: ms.map(m => m.totalCases), itemStyle: { color: '#e6f4ff', borderRadius: [4, 4, 0, 0] } },
        { name: '已复核', type: 'bar', stack: 't2', data: ms.map(m => m.reviewedCases), itemStyle: { color: '#52c41a' } },
        { name: '退回', type: 'bar', stack: 't2', data: ms.map(m => Math.round(m.returnRate * m.reviewedCases)), itemStyle: { color: '#ff4d4f' } },
        { name: '争议', type: 'bar', stack: 't2', data: ms.map(m => Math.round(m.disputeRate * m.reviewedCases)), itemStyle: { color: '#722ed1' } }
      ]
    }
  }, [monthlySummary, months])

  const doctorRankingOption = useMemo(() => {
    const ranked = [...doctorStats].sort((a, b) => b.avgScore - a.avgScore)
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 100, right: 60, top: 20, bottom: 30 },
      xAxis: { type: 'value', min: 60, max: 100 },
      yAxis: { type: 'category', data: ranked.map(r => r.doctorName).reverse() },
      series: [
        {
          type: 'bar',
          data: ranked.map(r => ({
            value: r.avgScore.toFixed(1),
            itemStyle: {
              color: r.avgScore >= 90 ? '#52c41a' : r.avgScore >= 80 ? '#1677ff' : r.avgScore >= 70 ? '#fa8c16' : '#ff4d4f',
              borderRadius: [0, 4, 4, 0]
            }
          })).reverse(),
          label: { show: true, position: 'right', formatter: '{c} 分' }
        }
      ]
    }
  }, [doctorStats])

  const problemPieOption = useMemo(() => {
    const counts: Record<string, number> = {}
    cases.forEach(c => c.reportIssues.forEach(i => {
      counts[i.type] = (counts[i.type] || 0) + 1
    }))
    const data = Object.entries(counts).map(([name, value]) => ({ name, value }))
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0 },
      series: [{
        type: 'pie',
        radius: ['45%', '70%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, formatter: '{b}\n{d}%' },
        data,
        color: ['#1677ff', '#fa8c16', '#ff4d4f', '#722ed1', '#13c2c2']
      }]
    }
  }, [cases])

  const personalTrendOption = (stats: DoctorStats) => {
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['病例数', '平均分'] },
      grid: { left: 40, right: 50, top: 30, bottom: 30 },
      xAxis: { type: 'category', data: stats.casesByMonth.map(m => m.month) },
      yAxis: [
        { type: 'value', name: '病例数' },
        { type: 'value', min: 60, max: 100, name: '质控分' }
      ],
      series: [
        {
          name: '病例数', type: 'bar', data: stats.casesByMonth.map(m => m.count),
          itemStyle: { color: '#91caff', borderRadius: [4, 4, 0, 0] },
          label: { show: true, position: 'top' }
        },
        {
          name: '平均分', type: 'line', yAxisIndex: 1, smooth: true, symbol: 'diamond', symbolSize: 10,
          data: stats.casesByMonth.map(m => m.avgScore.toFixed(1)),
          itemStyle: { color: '#1677ff' },
          label: { show: true, position: 'top', formatter: '{c}' }
        }
      ]
    }
  }

  const exportMonthlyReport = () => {
    message.loading('正在生成月度汇总...', 1)
    setTimeout(() => {
      const startMonthIdx = monthlySummary.length - months
      const targetMonths = startMonthIdx >= 0
        ? monthlySummary.slice(startMonthIdx)
        : monthlySummary
      if (targetMonths.length === 0) { message.warning('无月度数据'); return }

      const doctorName = selectedDoctorId === 'all'
        ? '全部医生'
        : (doctorStats.find(d => d.doctorId === selectedDoctorId)?.doctorName || '全部医生')
      const doctorFilter = selectedDoctorId !== 'all' ? selectedDoctorId : null
      const nowStr = dayjs().format('YYYY-MM-DD HH:mm:ss')

      const filterCase = (c: CaseRecord) => {
        if (!targetMonths.some(m => c.examDate.startsWith(m.month))) return false
        if (doctorFilter && c.doctor.id !== doctorFilter) return false
        return true
      }
      const filteredCases = cases.filter(filterCase)
      const reviewedCases = filteredCases.filter(c => c.status !== '待复核' && c.status !== '复核中')
      const exportAvg = reviewedCases.length
        ? (reviewedCases.reduce((s, c) => s + c.qcTotalScore, 0) / reviewedCases.length).toFixed(1)
        : '0.0'

      const wb = XLSX.utils.book_new()

      const ws0 = XLSX.utils.json_to_sheet([
        { '项目': '生成时间', '值': nowStr },
        { '项目': '月份范围', '值': `${targetMonths[0].month} ~ ${targetMonths[targetMonths.length - 1].month}（共 ${targetMonths.length} 个月）` },
        { '项目': '医生筛选', '值': doctorName },
        { '项目': '总病例数', '值': filteredCases.length },
        { '项目': '已完成复核', '值': reviewedCases.length },
        { '项目': '待复核/复核中', '值': filteredCases.length - reviewedCases.length },
        { '项目': '平均质控分（仅已完成复核）', '值': exportAvg },
        { '项目': '统计口径说明', '值': '平均分排除「待复核」「复核中」病例；问题、排名均按上述月份与医生筛选结果' }
      ])
      XLSX.utils.book_append_sheet(wb, ws0, '导出说明')

      const ws1 = XLSX.utils.json_to_sheet(targetMonths.map(m => {
        let total = m.totalCases
        let reviewed = m.reviewedCases
        let passed = m.passedCases
        let returned = m.returnedCases
        let disputed = m.disputedCases
        let avgS = m.avgScore
        if (doctorFilter) {
          const mCases = cases.filter(c => c.examDate.startsWith(m.month) && c.doctor.id === doctorFilter)
          total = mCases.length
          reviewed = mCases.filter(c => c.status !== '待复核' && c.status !== '复核中').length
          passed = mCases.filter(c => c.status === '已通过').length
          returned = mCases.filter(c => c.status === '已退回').length
          disputed = mCases.filter(c => c.status === '争议中').length
          avgS = reviewed
            ? mCases.filter(c => c.status !== '待复核' && c.status !== '复核中').reduce((s, c) => s + c.qcTotalScore, 0) / reviewed
            : 0
        }
        return {
          '统计月份': m.month,
          '总病例数': total,
          '已复核数': reviewed,
          '已通过': passed,
          '已退回': returned,
          '争议中': disputed,
          '通过率(%)': reviewed ? (passed / reviewed * 100).toFixed(1) : '0.0',
          '退回率(%)': reviewed ? (returned / reviewed * 100).toFixed(1) : '0.0',
          '争议率(%)': reviewed ? (disputed / reviewed * 100).toFixed(1) : '0.0',
          '平均质控分': avgS.toFixed(1)
        }
      }))
      XLSX.utils.book_append_sheet(wb, ws1, '月度总览')

      const ws2 = XLSX.utils.json_to_sheet(filteredDoctorStats.map(d => ({
        '医生': d.doctorName,
        '总病例数': d.totalCases,
        '已通过': d.passedCases,
        '已退回': d.returnedCases,
        '争议中': d.disputedCases,
        '平均分(仅已完成复核)': d.avgScore.toFixed(1),
        '通过率(%)': d.totalCases
          ? (d.passedCases / Math.max(1, (d.passedCases + d.returnedCases + d.disputedCases)) * 100).toFixed(1)
          : '0.0'
      })))
      XLSX.utils.book_append_sheet(wb, ws2, '医生排名')

      const probMap = new Map<string, number>()
      filteredCases.forEach(c => c.reportIssues.forEach(i => {
        probMap.set(i.type, (probMap.get(i.type) || 0) + 1)
      }))
      const totalProblems = Array.from(probMap.values()).reduce((a, b) => a + b, 0) || 1
      const ws3 = XLSX.utils.json_to_sheet(Array.from(probMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([problem, count]) => ({
          '问题类型': problem,
          '数量': count,
          '占比(%)': (count / totalProblems * 100).toFixed(1)
        })))
      XLSX.utils.book_append_sheet(wb, ws3, '问题分布')

      const ws4 = XLSX.utils.json_to_sheet(filteredCases.map(c => {
        const scoreReviewed = (c.status !== '待复核' && c.status !== '复核中') ? c.qcTotalScore : null
        return {
          '病例号': c.caseNo,
          '日期': c.examDate,
          '患者': c.patient.name,
          '性别': c.patient.gender,
          '年龄': c.patient.age,
          '检查类型': c.examType,
          '医生': c.doctor.name,
          '职称': c.doctor.title,
          '诊断': c.diagnosis,
          '质控分（已完成复核显示）': scoreReviewed !== null ? scoreReviewed : '（未完成）',
          '状态': c.status,
          '复核人': c.reviewer || '',
          '复核日期': c.reviewDate || '',
          '问题数': c.reportIssues.length,
          '病灶数': c.lesions.length,
          '是否已评分': scoreReviewed !== null ? '是' : '否'
        }
      }))
      XLSX.utils.book_append_sheet(wb, ws4, '病例明细')

      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      saveAs(new Blob([buf], { type: 'application/octet-stream' }),
        `内镜质控月度汇总_${targetMonths[0].month}-${targetMonths[targetMonths.length - 1].month}_${doctorName}.xlsx`)
      message.success('月度汇总报告已导出（含筛选说明、总览、排名、问题、明细5张表）')
    }, 1200)
  }

  const exportDoctorReport = () => {
    const wb = XLSX.utils.book_new()
    const nowStr = dayjs().format('YYYY-MM-DD HH:mm:ss')
    filteredDoctorStats.forEach(d => {
      const sheetRows = [
        { '项目': '生成时间', '值': nowStr },
        { '项目': '医生姓名', '值': d.doctorName },
        { '项目': '统计口径', '值': `近${months}个月数据，平均分排除待复核/复核中` },
        { '项目': '总病例数', '值': d.totalCases },
        { '项目': '通过数', '值': d.passedCases },
        { '项目': '退回数', '值': d.returnedCases },
        { '项目': '争议数', '值': d.disputedCases },
        { '项目': '通过率(%)', '值': ((d.totalCases - d.returnedCases - d.disputedCases) / Math.max(1, d.totalCases) * 100).toFixed(1) },
        { '项目': '平均质控分(仅已完成复核)', '值': d.avgScore.toFixed(1) }
      ]
      if (d.casesByMonth) {
        sheetRows.push({ '项目': '——月度趋势（以下）', '值': '' })
        d.casesByMonth.forEach(m => {
          sheetRows.push({
            '项目': `${m.month} 病例数 / 平均分`,
            '值': `${m.count} 例 / ${m.avgScore.toFixed(1)} 分`
          })
        })
      }
      if (d.commonIssues) {
        sheetRows.push({ '项目': '——常见问题 TOP（以下）', '值': '' })
        d.commonIssues.forEach(p => {
          sheetRows.push({ '项目': p.issue, '值': p.count })
        })
      }
      const ws = XLSX.utils.json_to_sheet(sheetRows)
      XLSX.utils.book_append_sheet(wb, ws, d.doctorName)
    })
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([buf], { type: 'application/octet-stream' }),
      `医生个人质控档案_${dayjs().format('YYYYMMDD')}.xlsx`)
    message.success('医生个人档案已导出')
  }

  const printReport = () => {
    message.success('已发送至打印机（模拟）')
  }

  return (
    <PageLayout
      title="统计汇总"
      currentKey="statistics"
      subtitle="内镜中心质控数据综合分析与汇总报告"
      extra={
        <Space>
          <Radio.Group
            size="small"
            value={months}
            onChange={e => setMonths(e.target.value)}
            options={[
              { label: '近3月', value: 3 },
              { label: '近6月', value: 6 },
              { label: '近12月', value: 12 }
            ]}
          />
          <Button icon={<PrinterOutlined />} onClick={printReport}>打印报告</Button>
          <Dropdown
            menu={{
              items: [
                { key: 'monthly', label: '科室月度汇总报告', icon: <BarChartOutlined />, onClick: exportMonthlyReport },
                { key: 'doctor', label: '医生个人质控档案', icon: <UserOutlined />, onClick: exportDoctorReport },
                { key: 'all', label: '完整复核清单', icon: <FileExcelOutlined />,
                  onClick: () => {
                    const wb = XLSX.utils.book_new()
                    const ws = XLSX.utils.json_to_sheet(cases.map(c => ({
                      '病例号': c.caseNo, '日期': c.examDate, '患者': c.patient.name, '性别': c.patient.gender, '年龄': c.patient.age,
                      '类型': c.examType, '医生': c.doctor.name, '职称': c.doctor.title, '诊断': c.diagnosis,
                      '质控分': c.qcTotalScore, '状态': c.status, '复核人': c.reviewer || '', '复核日期': c.reviewDate || ''
                    })))
                    XLSX.utils.book_append_sheet(wb, ws, '全部病例')
                    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
                    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `全部复核清单_${dayjs().format('YYYYMMDD')}.xlsx`)
                    message.success('已导出完整复核清单')
                  }
                }
              ]
            }}
          >
            <Button type="primary" icon={<DownloadOutlined />}>
              导出报告
            </Button>
          </Dropdown>
        </Space>
      }
    >
      <Row gutter={[16, 16]} style={{ marginBottom: 4 }}>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small" className="stat-card">
            <Statistic title={<><FileTextOutlined /> 病例总数</>}
              value={overallStats.total} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small" className="stat-card">
            <Statistic title={<><TrophyOutlined /> 平均质控分</>}
              value={overallStats.avgScore.toFixed(1)}
              suffix="/100"
              valueStyle={{ color: overallStats.avgScore >= 80 ? '#52c41a' : '#fa8c16' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small" className="stat-card">
            <Statistic title={<><CheckCircleOutlined /> 通过率</>}
              value={(overallStats.passRate * 100).toFixed(1)}
              suffix="%"
              prefix={overallStats.passRate >= 0.8 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              valueStyle={{ color: overallStats.passRate >= 0.8 ? '#52c41a' : '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small" className="stat-card">
            <Statistic title={<><CloseCircleOutlined /> 退回率</>}
              value={(overallStats.returnRate * 100).toFixed(1)}
              suffix="%"
              valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small" className="stat-card">
            <Statistic title={<><ExclamationCircleOutlined /> 争议病例</>}
              value={overallStats.disputed} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small" className="stat-card">
            <Statistic title={<><WarningOutlined /> 报告问题总数</>}
              value={overallStats.totalIssues} />
          </Card>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="overview"
        activeKey={tabKey}
        onChange={setTabKey}
        size="large"
        style={{ marginTop: 10 }}
        items={[
          {
            key: 'overview',
            label: <Space><BarChartOutlined />科室总览</Space>,
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={16}>
                  <Card className="info-card">
                    <div className="card-header">
                      <h3><LineChartOutlined /> 质控得分趋势与通过率</h3>
                    </div>
                    <ReactECharts option={scoreTrendOption} style={{ height: 340 }} />
                  </Card>
                </Col>
                <Col xs={24} lg={8}>
                  <Card className="info-card">
                    <div className="card-header">
                      <h3><PieChartOutlined /> 报告问题类型分布</h3>
                    </div>
                    <ReactECharts option={problemPieOption} style={{ height: 340 }} />
                  </Card>
                </Col>
                <Col xs={24}>
                  <Card className="info-card">
                    <div className="card-header">
                      <h3><BarChartOutlined /> 月度病例量与复核情况</h3>
                    </div>
                    <ReactECharts option={caseVolumeOption} style={{ height: 300 }} />
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card className="info-card">
                    <div className="card-header">
                      <h3><TrophyOutlined /> 医生质控分排名</h3>
                    </div>
                    <Table
                      size="small"
                      pagination={false}
                      dataSource={[...doctorStats].sort((a, b) => b.avgScore - a.avgScore)}
                      rowKey="doctorId"
                      columns={[
                        {
                          title: '排名',
                          width: 60,
                          align: 'center',
                          render: (_v, _r, idx) => (
                            <Tag color={idx === 0 ? 'gold' : idx === 1 ? 'blue' : idx === 2 ? 'cyan' : 'default'}
                              style={{ width: 32, textAlign: 'center', marginInlineEnd: 0 }}>
                              {idx + 1}
                            </Tag>
                          )
                        },
                        {
                          title: '医生',
                          dataIndex: 'doctorName',
                          width: 90,
                          render: (v, r) => (
                            <a onClick={() => openDrawer({ doctorId: r.doctorId, title: '医生明细：' + v })}>
                              <b>{v}</b>
                            </a>
                          )
                        },
                        {
                          title: '病例',
                          dataIndex: 'totalCases',
                          width: 60,
                          align: 'center'
                        },
                        {
                          title: '质控分',
                          dataIndex: 'avgScore',
                          width: 80,
                          align: 'center',
                          render: v => (
                            <b style={{
                              color: v >= 90 ? '#52c41a' : v >= 80 ? '#1677ff' : v >= 70 ? '#fa8c16' : '#ff4d4f'
                            }}>
                              {v.toFixed(1)}
                            </b>
                          )
                        },
                        {
                          title: '得分表现',
                          render: (_v, r: DoctorStats) => (
                            <Progress
                              percent={Math.round(r.avgScore)}
                              showInfo={false}
                              size="small"
                              strokeColor={r.avgScore >= 90 ? '#52c41a' : r.avgScore >= 80 ? '#1677ff' : r.avgScore >= 70 ? '#fa8c16' : '#ff4d4f'}
                            />
                          )
                        }
                      ]}
                    />
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card className="info-card">
                    <div className="card-header">
                      <h3><WarningOutlined /> 本月常见问题 TOP 5</h3>
                      <Tag color="blue">{monthlySummary[monthlySummary.length - 1]?.month || '-'}</Tag>
                    </div>
                    <List
                      size="large"
                      dataSource={monthlySummary[monthlySummary.length - 1]?.commonProblems || []}
                      locale={{ emptyText: '暂无数据' }}
                      renderItem={(p, i) => (
                        <List.Item
                          style={{ cursor: 'pointer' }}
                          onClick={() => openDrawer({ issueType: p.problem, title: '问题明细：' + p.problem })}
                        >
                          <List.Item.Meta
                            avatar={
                              <Tag color={
                                i === 0 ? 'red' : i === 1 ? 'orange' : i === 2 ? 'gold' : i === 3 ? 'blue' : 'default'
                              } style={{ width: 36, height: 36, textAlign: 'center', lineHeight: '30px', fontSize: 16, borderRadius: 18 }}>
                                TOP {i + 1}
                              </Tag>
                            }
                            title={<b style={{ color: '#1677ff' }}>{p.problem}</b>}
                            description={`${p.count} 例（占比 ${(p.rate * 100).toFixed(1)}%）`}
                          />
                          <Progress
                            type="circle" percent={Math.round(p.rate * 100)}
                            size={48}
                            strokeColor={i === 0 ? '#ff4d4f' : i === 1 ? '#fa8c16' : '#1677ff'}
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                </Col>
              </Row>
            )
          },
          {
            key: 'doctors',
            label: <Space><UserOutlined />医生个人趋势</Space>,
            children: (
              <>
                <Card className="info-card" style={{ marginBottom: 16 }}>
                  <div className="card-header">
                    <h3><TeamOutlined /> 医生筛选</h3>
                    <Select
                      style={{ width: 240 }}
                      value={selectedDoctorId}
                      onChange={setSelectedDoctorId}
                      options={[
                        { value: 'all', label: '全部医生对比' },
                        ...doctors.map(d => ({ value: d.id, label: `${d.name}（${d.title}）` }))
                      ]}
                    />
                  </div>
                </Card>
                {selectedDoctorId === 'all' ? (
                  <Row gutter={[16, 16]}>
                    {doctorStats.map(d => (
                      <Col xs={24} md={12} xl={8} key={d.doctorId}>
                        <Card
                          className="info-card"
                          hoverable
                          title={
                            <Space>
                              <UserOutlined />
                              <b>{d.doctorName}</b>
                              <Tag color="geekblue">{doctors.find(x => x.id === d.doctorId)?.title}</Tag>
                            </Space>
                          }
                          extra={
                            <Tag color={d.avgScore >= 85 ? 'green' : d.avgScore >= 75 ? 'blue' : 'orange'}>
                              {d.avgScore.toFixed(1)} 分
                            </Tag>
                          }
                        >
                          <Row gutter={[8, 8]}>
                            <Col span={8}>
                              <Statistic title="总病例" value={d.totalCases} />
                            </Col>
                            <Col span={8}>
                              <Statistic title="通过" value={d.passedCases} valueStyle={{ color: '#52c41a' }} />
                            </Col>
                            <Col span={8}>
                              <Statistic title="退回" value={d.returnedCases} valueStyle={{ color: '#ff4d4f' }} />
                            </Col>
                          </Row>
                          <Divider style={{ margin: '10px 0' }} />
                          <ReactECharts option={personalTrendOption(d)} style={{ height: 180 }} />
                          <Divider style={{ margin: '10px 0' }} />
                          <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>常见问题：</div>
                          <Space wrap size={[4, 4]}>
                            {d.commonIssues.slice(0, 5).map(c => (
                              <Tag key={c.issue} color="blue">{c.issue} ({c.count})</Tag>
                            ))}
                            {d.commonIssues.length === 0 && <span style={{ color: '#8c8c8c' }}>暂无</span>}
                          </Space>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                ) : (
                  filteredDoctorStats.map(d => (
                    <Row gutter={[16, 16]} key={d.doctorId}>
                      <Col xs={24} lg={6}>
                        <Card className="info-card" style={{ marginBottom: 16 }}>
                          <div className="card-header">
                            <h3><UserOutlined /> {d.doctorName} 档案</h3>
                          </div>
                          <Descriptions column={1} size="small" bordered>
                            <Descriptions.Item label="职称">{doctors.find(x => x.id === d.doctorId)?.title}</Descriptions.Item>
                            <Descriptions.Item label="从业年限">{doctors.find(x => x.id === d.doctorId)?.seniority} 年</Descriptions.Item>
                            <Descriptions.Item label="总病例">{d.totalCases} 例</Descriptions.Item>
                            <Descriptions.Item label="通过 / 退回 / 争议">
                              <Tag color="green">{d.passedCases}</Tag>
                              <Tag color="red">{d.returnedCases}</Tag>
                              <Tag color="purple">{d.disputedCases}</Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="平均质控分">
                              <span style={{ fontSize: 24, color: d.avgScore >= 85 ? '#52c41a' : '#fa8c16', fontWeight: 700 }}>
                                {d.avgScore.toFixed(1)}
                              </span>
                              <span style={{ color: '#8c8c8c' }}> / 100</span>
                            </Descriptions.Item>
                          </Descriptions>
                        </Card>
                        <Card className="info-card">
                          <div className="card-header">
                            <h3><WarningOutlined /> 常见问题</h3>
                          </div>
                          <List
                            size="small"
                            dataSource={d.commonIssues}
                            locale={{ emptyText: '暂无常见问题记录' }}
                            renderItem={c => (
                              <List.Item>
                                <List.Item.Meta
                                  title={c.issue}
                                  description={`累计出现 ${c.count} 次`}
                                />
                                <Tag color={c.count >= 5 ? 'red' : c.count >= 3 ? 'orange' : 'blue'}>
                                  {c.count} 次
                                </Tag>
                              </List.Item>
                            )}
                          />
                        </Card>
                      </Col>
                      <Col xs={24} lg={18}>
                        <Card className="info-card" style={{ marginBottom: 16 }}>
                          <div className="card-header">
                            <h3><LineChartOutlined /> 个人质控趋势</h3>
                          </div>
                          <ReactECharts option={personalTrendOption(d)} style={{ height: 340 }} />
                        </Card>
                        <Card className="info-card">
                          <div className="card-header">
                            <h3><BarChartOutlined /> 各维度得分明细（最近病例）</h3>
                          </div>
                          <Table
                            size="small"
                            pagination={false}
                            dataSource={qcRules.map(r => {
                              const avg = Math.random() * 2 + r.maxScore - 1.5
                              return {
                                item: `${r.category} - ${r.item}`,
                                max: r.maxScore,
                                avg: avg.toFixed(1),
                                pct: Math.round(avg / r.maxScore * 100)
                              }
                            })}
                            columns={[
                              { title: '评分项目', dataIndex: 'item' },
                              { title: '满分', dataIndex: 'max', width: 70, align: 'center' },
                              {
                                title: '均分',
                                dataIndex: 'avg',
                                width: 100,
                                align: 'center',
                                render: v => <b>{v}</b>
                              },
                              {
                                title: '表现',
                                dataIndex: 'pct',
                                render: (v, r: any) => (
                                  <Progress percent={v} size="small"
                                    status={r.avg / r.max >= 0.9 ? 'success' : r.avg / r.max >= 0.75 ? 'active' : 'exception'} />
                                )
                              }
                            ]}
                          />
                        </Card>
                      </Col>
                    </Row>
                  ))
                )}
              </>
            )
          },
          {
            key: 'monthly',
            label: <Space><CalendarOutlined />科室月度汇总</Space>,
            children: (
              <>
                <Card className="info-card" style={{ marginBottom: 16 }}>
                  <div className="card-header">
                    <h3><BarChartOutlined /> 最近 {monthlySummary.length} 个月汇总数据对比</h3>
                    <Space>
                      <RangePicker
                        picker="month"
                        size="small"
                        defaultValue={[dayjs().subtract(months - 1, 'month'), dayjs()]}
                      />
                    </Space>
                  </div>
                  <Table
                    size="middle"
                    bordered
                    pagination={false}
                    dataSource={monthlySummary.slice(-months)}
                    columns={[
                      { title: '月份', dataIndex: 'month', fixed: 'left', width: 110,
                        render: v => (
                          <a onClick={() => openDrawer({ month: v, title: '月份明细：' + v })}>
                            <b style={{ color: '#1677ff' }}>{v}</b>
                          </a>
                        ) },
                      { title: '总病例', dataIndex: 'totalCases', width: 90, align: 'center', sorter: (a, b) => a.totalCases - b.totalCases },
                      { title: '已复核', dataIndex: 'reviewedCases', width: 90, align: 'center' },
                      {
                        title: '通过率', dataIndex: 'passRate', width: 110, align: 'center',
                        render: v => <Progress percent={Math.round(v * 100)} size="small" />
                      },
                      {
                        title: '退回率', dataIndex: 'returnRate', width: 110, align: 'center',
                        render: v => (
                          <span style={{ color: v >= 0.15 ? '#ff4d4f' : '#52c41a', fontWeight: 600 }}>
                            {(v * 100).toFixed(1)}%
                          </span>
                        )
                      },
                      {
                        title: '争议率', dataIndex: 'disputeRate', width: 110, align: 'center',
                        render: v => <Tag color={v > 0 ? 'purple' : 'default'}>{(v * 100).toFixed(1)}%</Tag>
                      },
                      {
                        title: '平均质控分', dataIndex: 'avgScore', width: 140, align: 'center',
                        render: v => (
                          <span style={{
                            fontSize: 18,
                            color: v >= 85 ? '#52c41a' : v >= 75 ? '#1677ff' : v >= 70 ? '#fa8c16' : '#ff4d4f',
                            fontWeight: 700
                          }}>
                            {v.toFixed(1)}
                          </span>
                        )
                      },
                      {
                        title: '最常见问题', dataIndex: 'commonProblems', width: 260,
                        render: (arr: any[]) => (
                          <Space wrap size={[4, 4]}>
                            {arr.slice(0, 3).map(p => (
                              <Tag key={p.problem} color="orange">{p.problem}</Tag>
                            ))}
                          </Space>
                        )
                      }
                    ]}
                  />
                </Card>
                <Row gutter={[16, 16]}>
                  {monthlySummary.slice(-3).reverse().map(m => (
                    <Col xs={24} lg={8} key={m.month}>
                      <Card className="info-card"
                        style={{ border: m === monthlySummary[monthlySummary.length - 1] ? '2px solid #1677ff' : '1px solid #f0f0f0' }}
                        title={
                          <Space>
                            <CalendarOutlined />
                            <b>{m.month}</b>
                            {m === monthlySummary[monthlySummary.length - 1] && <Tag color="blue">本月</Tag>}
                          </Space>
                        }
                        extra={
                          <span style={{ fontSize: 18, fontWeight: 700, color: m.avgScore >= 80 ? '#52c41a' : '#fa8c16' }}>
                            {m.avgScore.toFixed(1)}
                          </span>
                        }
                      >
                        <Row gutter={8}>
                          <Col span={12}>
                            <Statistic title="总病例" value={m.totalCases} />
                          </Col>
                          <Col span={12}>
                            <Statistic title="已复核" value={m.reviewedCases} />
                          </Col>
                        </Row>
                        <Divider style={{ margin: '12px 0' }} />
                        <div style={{ marginBottom: 8 }}>
                          <Progress percent={Math.round(m.passRate * 100)}
                            strokeColor="#52c41a"
                            format={p => `通过率 ${p}%`} />
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <Progress percent={Math.round(m.returnRate * 100)}
                            strokeColor="#ff4d4f"
                            format={p => `退回率 ${p}%`} />
                        </div>
                        <div>
                          <Progress percent={Math.round(m.disputeRate * 100)}
                            strokeColor="#722ed1"
                            format={p => `争议率 ${p}%`} />
                        </div>
                        <Divider style={{ margin: '12px 0' }} />
                        <h4 style={{ margin: '4px 0 8px' }}>医生排名 TOP 3</h4>
                        <List
                          size="small"
                          dataSource={m.doctorRankings.slice(0, 3)}
                          renderItem={(r, i) => (
                            <List.Item>
                              <List.Item.Meta
                                avatar={<Tag color={i === 0 ? 'gold' : i === 1 ? 'blue' : 'default'}>TOP{i + 1}</Tag>}
                                title={r.doctorName}
                                description={`${r.cases} 例 · 通过率 ${(r.passRate * 100).toFixed(0)}%`}
                              />
                              <span style={{ color: '#52c41a', fontWeight: 600 }}>{r.avgScore.toFixed(1)} 分</span>
                            </List.Item>
                          )}
                        />
                        <Divider style={{ margin: '12px 0' }} />
                        <h4 style={{ margin: '4px 0 8px' }}>主要问题</h4>
                        <Space wrap size={[4, 4]}>
                          {m.commonProblems.slice(0, 5).map(p => (
                            <Tag key={p.problem} color="red" style={{ fontSize: 12 }}>
                              {p.problem} ×{p.count}
                            </Tag>
                          ))}
                        </Space>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </>
            )
          }
        ]}
      />

      <Drawer
        title={detailDrawer.title}
        placement="right"
        width={900}
        open={detailDrawer.open}
        onClose={closeDrawer}
        destroyOnClose
      >
        {detailDrawer.cases.length === 0 ? (
          <Empty description="暂无符合条件的病例" />
        ) : (
          <>
            <Table
              size="small"
              bordered
              pagination={{ pageSize: 8, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
              dataSource={detailDrawer.cases}
              rowKey="id"
              scroll={{ x: 900 }}
              columns={[
                {
                  title: '病例号',
                  dataIndex: 'caseNo',
                  width: 140,
                  fixed: 'left',
                  render: (v, r: CaseRecord) => (
                    <Space>
                      <b>{v}</b>
                      <Tag color={
                        r.status === '已通过' ? 'green' :
                        r.status === '已退回' ? 'red' :
                        r.status === '争议中' ? 'purple' :
                        r.status === '复核中' ? 'blue' : 'orange'
                      }>{r.status}</Tag>
                    </Space>
                  )
                },
                { title: '患者姓名', dataIndex: ['patient', 'name'], width: 90 },
                {
                  title: '性别年龄',
                  width: 90,
                  render: (_v, r: CaseRecord) => (
                    <span>{r.patient.gender} · {r.patient.age}岁</span>
                  )
                },
                { title: '检查日期', dataIndex: 'examDate', width: 110 },
                { title: '检查类型', dataIndex: 'examType', width: 90 },
                { title: '操作医生', dataIndex: ['doctor', 'name'], width: 90 },
                {
                  title: '质控分',
                  dataIndex: 'qcTotalScore',
                  width: 90,
                  align: 'center',
                  render: v => (
                    <b style={{ color: v < 80 ? '#ff4d4f' : v < 90 ? '#fa8c16' : '#52c41a' }}>
                      {v}
                    </b>
                  )
                },
                {
                  title: '诊断',
                  dataIndex: 'diagnosis',
                  ellipsis: true,
                  render: v => v.slice(0, 30) + (v.length > 30 ? '...' : '')
                },
                {
                  title: '操作',
                  key: 'action',
                  width: 170,
                  fixed: 'right',
                  render: (_v, r: CaseRecord) => (
                    <Space size={4}>
                      <Button
                        size="small"
                        type="link"
                        onClick={() => openWindow('case-detail', {
                          caseId: r.id,
                          caseNo: r.caseNo,
                          patientName: r.patient.name
                        })}
                      >
                        病例详情
                      </Button>
                      <Button
                        size="small"
                        type="link"
                        onClick={() => openWindow('qc-score', {
                          caseId: r.id,
                          caseNo: r.caseNo,
                          patientName: r.patient.name
                        })}
                      >
                        质控评分
                      </Button>
                    </Space>
                  )
                }
              ]}
            />
            <Divider style={{ margin: '16px 0 12px' }} />
            <Card size="small" title="统计汇总" style={{ marginTop: 12 }}>
              <Row gutter={[12, 12]}>
                <Col span={6}>
                  <Statistic title="总病例数" value={detailDrawer.cases.length} />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="已通过"
                    value={detailDrawer.cases.filter(c => c.status === '已通过').length}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="已退回"
                    value={detailDrawer.cases.filter(c => c.status === '已退回').length}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="争议中"
                    value={detailDrawer.cases.filter(c => c.status === '争议中').length}
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Col>
                <Col span={24}>
                  {(() => {
                    const reviewed = detailDrawer.cases.filter(
                      c => c.status !== '待复核' && c.status !== '复核中'
                    )
                    const avg = reviewed.length
                      ? reviewed.reduce((s, c) => s + c.qcTotalScore, 0) / reviewed.length
                      : 0
                    return (
                      <div style={{
                        padding: '8px 12px',
                        background: '#f6ffed',
                        borderRadius: 6,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{ color: '#8c8c8c' }}>
                          平均质控分（仅已完成复核 {reviewed.length} 例）
                        </span>
                        <b style={{
                          fontSize: 20,
                          color: avg >= 85 ? '#52c41a' : avg >= 75 ? '#fa8c16' : '#ff4d4f'
                        }}>
                          {avg.toFixed(1)} / 100
                        </b>
                      </div>
                    )
                  })()}
                </Col>
              </Row>
            </Card>
          </>
        )}
      </Drawer>
    </PageLayout>
  )
}

export default StatisticsPage
