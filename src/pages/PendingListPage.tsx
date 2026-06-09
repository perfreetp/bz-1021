import React, { useMemo } from 'react'
import {
  Row, Col, Card, Form, Input, Select, DatePicker, Button, Table, Tag, Space,
  Statistic, Progress, Badge, Dropdown, Menu, App
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  SearchOutlined, ReloadOutlined, FileTextOutlined, EyeOutlined,
  PictureOutlined, BulbOutlined, AuditOutlined, TrophyOutlined,
  ExportOutlined, ClockCircleOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ExclamationCircleOutlined, SyncOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import PageLayout, { openWindow } from '../components/PageLayout'
import { useAppStore, doctors } from '../store/useAppStore'
import type { CaseRecord, ExamType, CaseStatus } from '../types'

const { RangePicker } = DatePicker

const statusColors: Record<CaseStatus, string> = {
  '待复核': 'orange',
  '复核中': 'blue',
  '已通过': 'green',
  '已退回': 'red',
  '争议中': 'purple'
}

const statusIcons: Record<CaseStatus, React.ReactNode> = {
  '待复核': <ClockCircleOutlined />,
  '复核中': <SyncOutlined spin />,
  '已通过': <CheckCircleOutlined />,
  '已退回': <CloseCircleOutlined />,
  '争议中': <ExclamationCircleOutlined />
}

const examTypeColors: Record<ExamType, string> = {
  '胃镜': 'blue',
  '结肠镜': 'cyan',
  '十二指肠镜': 'geekblue',
  '小肠镜': 'purple',
  '超声内镜': 'magenta'
}

const PendingListPage: React.FC = () => {
  const { message, modal } = App.useApp()
  const [form] = Form.useForm()
  const { cases, filters, setFilters, resetFilters, getFilteredCases, setCurrentCase } = useAppStore()

  const filteredCases = getFilteredCases()

  const stats = useMemo(() => {
    const total = filteredCases.length
    const pending = filteredCases.filter(c => c.status === '待复核').length
    const reviewing = filteredCases.filter(c => c.status === '复核中').length
    const passed = filteredCases.filter(c => c.status === '已通过').length
    const returned = filteredCases.filter(c => c.status === '已退回').length
    const disputed = filteredCases.filter(c => c.status === '争议中').length
    const avgScore = total
      ? filteredCases.filter(c => c.status !== '待复核' && c.status !== '复核中')
          .reduce((s, c) => s + c.qcTotalScore, 0) / Math.max(1, (total - pending - reviewing))
      : 0
    return { total, pending, reviewing, passed, returned, disputed, avgScore }
  }, [filteredCases])

  const handleSearch = () => {
    const values = form.getFieldsValue()
    setFilters({
      startDate: values.dateRange?.[0]?.format('YYYY-MM-DD'),
      endDate: values.dateRange?.[1]?.format('YYYY-MM-DD'),
      doctorId: values.doctorId,
      examType: values.examType,
      status: values.status,
      keyword: values.keyword?.trim()
    })
  }

  const handleReset = () => {
    form.resetFields()
    resetFilters()
  }

  const openCase = async (case_: CaseRecord, subPage?: string) => {
    setCurrentCase(case_.id)
    const winName = subPage || 'case-detail'
    await openWindow(winName, { caseId: case_.id })
    const subPageName = subPage === 'image-compare'
      ? '图像对比'
      : subPage === 'diagnosis'
        ? '诊断建议'
        : subPage === 'report-proof'
          ? '报告校对'
          : subPage === 'qc-score'
            ? '质控评分'
            : '病例详情'
    message.success(`已打开【${case_.caseNo}】${subPageName}窗口`)
  }

  const exportList = async () => {
    if (filteredCases.length === 0) {
      message.warning('当前没有可导出的数据')
      return
    }
    modal.confirm({
      title: '导出复核清单',
      content: `将导出 ${filteredCases.length} 条病例记录到 Excel 文件，是否继续？`,
      okText: '确认导出',
      cancelText: '取消',
      onOk: () => {
        const data = filteredCases.map(c => ({
          '病例编号': c.caseNo,
          '检查日期': c.examDate,
          '患者姓名': c.patient.name,
          '性别': c.patient.gender,
          '年龄': c.patient.age,
          '病历号': c.patient.medicalRecordNo,
          '检查类型': c.examType,
          '操作医生': c.doctor.name,
          '职称': c.doctor.title,
          '检查时长': `${c.startTime} - ${c.endTime}`,
          '主要诊断': c.diagnosis,
          '息肉数': c.lesions.filter(l => l.type === '息肉').length,
          '活检数': c.biopsy.length,
          '报告问题数': c.reportIssues.length,
          '质控总分': c.qcTotalScore,
          '状态': c.status,
          '复核人': c.reviewer || '-',
          '复核日期': c.reviewDate || '-'
        }))
        const ws = XLSX.utils.json_to_sheet(data)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, '复核清单')
        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
        saveAs(new Blob([buf], { type: 'application/octet-stream' }),
          `复核清单_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`)
        message.success('导出成功')
      }
    })
  }

  const columns: ColumnsType<CaseRecord> = [
    {
      title: '病例编号',
      dataIndex: 'caseNo',
      width: 140,
      fixed: 'left',
      render: (v, r) => (
        <a onClick={() => openCase(r)} style={{ fontFamily: 'monospace' }}>{v}</a>
      )
    },
    {
      title: '检查日期',
      dataIndex: 'examDate',
      width: 110,
      sorter: (a, b) => a.examDate.localeCompare(b.examDate)
    },
    {
      title: '患者信息',
      width: 160,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.patient.name}
            <Tag style={{ marginLeft: 6 }} color={r.patient.gender === '男' ? 'blue' : 'pink'}>
              {r.patient.gender}
            </Tag>
            <span style={{ color: '#8c8c8c', marginLeft: 4 }}>{r.patient.age}岁</span>
          </div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{r.patient.medicalRecordNo}</div>
        </div>
      )
    },
    {
      title: '检查类型',
      dataIndex: 'examType',
      width: 96,
      render: (v: ExamType) => <Tag color={examTypeColors[v]}>{v}</Tag>,
      filters: (['胃镜', '结肠镜', '十二指肠镜', '小肠镜', '超声内镜'] as ExamType[]).map(t => ({ text: t, value: t })),
      onFilter: (v, r) => r.examType === v
    },
    {
      title: '操作医生',
      width: 110,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.doctor.name}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{r.doctor.title}</div>
        </div>
      ),
      filters: doctors.map(d => ({ text: d.name, value: d.id })),
      onFilter: (v, r) => r.doctor.id === v
    },
    {
      title: '主要诊断',
      dataIndex: 'diagnosis',
      ellipsis: true,
      width: 220
    },
    {
      title: '关键指标',
      width: 160,
      render: (_, r) => (
        <Space size="small" direction="vertical">
          {r.lesions.length > 0 && (
            <Tag color="blue">病灶 {r.lesions.length} 处</Tag>
          )}
          {r.biopsy.length > 0 && (
            <Tag color="purple">活检 {r.biopsy.reduce((s, b) => s + b.pieces, 0)} 块</Tag>
          )}
          {r.reportIssues.length > 0 && (
            <Tag color={r.reportIssues.some(i => i.severity === '高') ? 'red' : 'orange'}>
              问题 {r.reportIssues.length}
            </Tag>
          )}
        </Space>
      )
    },
    {
      title: '质控分',
      dataIndex: 'qcTotalScore',
      width: 120,
      sorter: (a, b) => a.qcTotalScore - b.qcTotalScore,
      render: (v: number) => {
        const pct = v / 100 * 100
        const color = v >= 90 ? '#52c41a' : v >= 80 ? '#1677ff' : v >= 70 ? '#fa8c16' : '#ff4d4f'
        return (
          <Progress
            type="dashboard"
            percent={pct}
            size={60}
            strokeColor={color}
            format={p => <span style={{ fontSize: 12, fontWeight: 600, color }}>{v}</span>}
          />
        )
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: CaseStatus) => (
        <Badge status={statusColors[s] as any} text={
          <Tag color={statusColors[s]} icon={statusIcons[s]}>{s}</Tag>
        } />
      ),
      filters: (['待复核', '复核中', '已通过', '已退回', '争议中'] as CaseStatus[]).map(s => ({ text: s, value: s })),
      onFilter: (v, r) => r.status === v
    },
    {
      title: '操作',
      width: 180,
      fixed: 'right',
      render: (_, r) => (
        <Dropdown
          menu={{
            items: [
              { key: 'detail', icon: <FileTextOutlined />, label: '病例详情', onClick: () => openCase(r) },
              { key: 'img', icon: <PictureOutlined />, label: '图像对比', onClick: () => openCase(r, 'image-compare') },
              { key: 'diag', icon: <BulbOutlined />, label: '诊断建议', onClick: () => openCase(r, 'diagnosis') },
              { key: 'report', icon: <AuditOutlined />, label: '报告校对', onClick: () => openCase(r, 'report-proof') },
              { key: 'qc', icon: <TrophyOutlined />, label: '质控评分', onClick: () => openCase(r, 'qc-score') }
            ]
          }}
        >
          <Button type="primary" size="small" icon={<EyeOutlined />}>
            复核操作
          </Button>
        </Dropdown>
      )
    }
  ]

  return (
    <PageLayout
      title="待复核病例列表"
      currentKey="pending-list"
      subtitle="内镜中心质控复核工作台 - 按日期、医生、检查类型筛选并管理待复核病例"
      extra={
        <Button type="primary" icon={<ExportOutlined />} onClick={exportList}>
          导出清单
        </Button>
      }
    >
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card size="small" className="stat-card">
            <Statistic
              title="病例总数"
              value={stats.total}
              prefix={<FileTextOutlined />}
              valueStyle={{ fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card size="small" className="stat-card">
            <Statistic
              title="待复核"
              value={stats.pending}
              valueStyle={{ color: '#fa8c16', fontSize: 22 }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card size="small" className="stat-card">
            <Statistic
              title="复核中"
              value={stats.reviewing}
              valueStyle={{ color: '#1677ff', fontSize: 22 }}
              prefix={<SyncOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card size="small" className="stat-card">
            <Statistic
              title="已通过"
              value={stats.passed}
              valueStyle={{ color: '#52c41a', fontSize: 22 }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card size="small" className="stat-card">
            <Statistic
              title="已退回"
              value={stats.returned}
              valueStyle={{ color: '#ff4d4f', fontSize: 22 }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card size="small" className="stat-card">
            <Statistic
              title="平均质控分"
              value={stats.avgScore.toFixed(1)}
              valueStyle={{ color: '#722ed1', fontSize: 22 }}
              prefix={<TrophyOutlined />}
              suffix=" / 100"
            />
          </Card>
        </Col>
      </Row>

      <Card className="info-card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3>筛选条件</h3>
        </div>
        <Form form={form} layout="vertical" onFinish={handleSearch}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item label="检查日期范围" name="dateRange">
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item label="操作医生" name="doctorId">
                <Select
                  allowClear
                  placeholder="全部医生"
                  options={doctors.map(d => ({ value: d.id, label: `${d.name}（${d.title}）` }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item label="检查类型" name="examType">
                <Select
                  allowClear
                  placeholder="全部类型"
                  options={(['胃镜', '结肠镜', '十二指肠镜', '小肠镜', '超声内镜'] as ExamType[])
                    .map(t => ({ value: t, label: t }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item label="病例状态" name="status">
                <Select
                  allowClear
                  placeholder="全部状态"
                  options={(['待复核', '复核中', '已通过', '已退回', '争议中'] as CaseStatus[])
                    .map(s => ({ value: s, label: s }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item label="关键字搜索（病例号/患者/诊断）" name="keyword">
                <Input prefix={<SearchOutlined />} placeholder="输入关键字..." allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} md={6} style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 24 }}>
              <Space>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>查询</Button>
                <Button onClick={handleReset} icon={<ReloadOutlined />}>重置</Button>
              </Space>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card className="info-card">
        <div className="card-header">
          <h3>病例列表（共 {filteredCases.length} 条）</h3>
        </div>
        <Table<CaseRecord>
          size="middle"
          rowKey="id"
          dataSource={filteredCases}
          columns={columns}
          scroll={{ x: 1400, y: 520 }}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条病例`
          }}
          onRow={(r) => ({
            onDoubleClick: () => openCase(r)
          })}
        />
      </Card>
    </PageLayout>
  )
}

export default PendingListPage
