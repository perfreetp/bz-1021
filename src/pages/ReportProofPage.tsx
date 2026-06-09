import React, { useEffect, useMemo, useState } from 'react'
import {
  Row, Col, Card, Tag, Button, Space, Divider, List, Alert,
  Form, Input, Select, Modal, App, Tooltip, Table, Descriptions,
  Radio, Checkbox, InputNumber, Statistic, Badge, Empty, Progress, Result
} from 'antd'
import {
  AuditOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ExclamationCircleOutlined, WarningOutlined, PlusOutlined,
  DeleteOutlined, FileTextOutlined, ExperimentOutlined,
  TrophyOutlined, BookOutlined, SearchOutlined, EyeOutlined
} from '@ant-design/icons'
import PageLayout, { openWindow, getQueryParams } from '../components/PageLayout'
import { useAppStore } from '../store/useAppStore'
import type { CaseRecord, ReportIssue, BiopsyItem } from '../types'

const termDictionary: Record<string, string[]> = {
  '胃镜规范术语': [
    '慢性非萎缩性胃炎', '慢性萎缩性胃炎', '反流性食管炎', 'Barrett食管',
    '胃息肉', '胃溃疡', '十二指肠球部溃疡', '平坦糜烂', '隆起糜烂'
  ],
  '肠镜规范术语': [
    '结肠息肉', '侧向发育型肿瘤（LST）', '溃疡性结肠炎', '克罗恩病',
    '结肠憩室', '结肠黑变病', '缺血性肠炎', '感染性肠炎'
  ],
  '息肉分型（Paris）': [
    'Paris Ⅰ型（有蒂）', 'Paris Ⅱa型（表浅隆起）', 'Paris Ⅱb型（平坦）',
    'Paris Ⅱc型（表浅凹陷）', 'Paris Ⅲ型（溃疡型）'
  ],
  '溃疡分期': [
    '活动期 A1', '活动期 A2', '愈合期 H1', '愈合期 H2', '瘢痕期 S1', '瘢痕期 S2'
  ],
  '炎症程度': ['轻度炎症', '中度炎症', '重度炎症']
}

const nonStandardTerms: { wrong: string; correct: string; note: string }[] = [
  { wrong: '胃糜烂', correct: '平坦/隆起糜烂性胃炎', note: '需指明糜烂类型' },
  { wrong: '胃有一个息肉', correct: '胃息肉（Paris 分型说明）', note: '息肉需标注大小、分型、部位' },
  { wrong: '有点发炎', correct: '轻/中/重度炎症', note: '炎症需说明程度' },
  { wrong: '溃疡', correct: '溃疡（注明分期A1/A2/H1/H2/S1/S2）', note: '溃疡必须标注分期' },
  { wrong: '肠息肉切除', correct: '息肉EMR/ESD/APC切除', note: '切除方式需说明' }
]

const ReportProofPage: React.FC = () => {
  const { message, modal } = App.useApp()
  const {
    cases, setCurrentCase, addReportIssue, removeReportIssue, toggleIssueFixed, setBiopsyVerification, currentCaseId
  } = useAppStore()
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>()
  const [addIssueModal, setAddIssueModal] = useState(false)
  const [form] = Form.useForm()
  const [biopsyVerified, setBiopsyVerified] = useState<Record<string, boolean>>({})
  const [termFixed, setTermFixed] = useState<Record<string, boolean>>({})
  const [reportChecked, setReportChecked] = useState(false)

  useEffect(() => {
    const params = getQueryParams()
    const id = params.caseId || currentCaseId
    const caseList = cases
    const target = id
      ? caseList.find(c => c.id === id)
      : caseList.find(c => c.reportIssues.length > 0) || caseList[0]
    if (target) {
      setCurrentCase(target.id, false)
      setSelectedCaseId(target.id)
      const initBio: Record<string, boolean> = {}
      target.biopsy.forEach(b => {
        const persisted = target.biopsyVerifications?.[b.bottleNo]
        initBio[b.bottleNo] = persisted ? (persisted.siteMatch && persisted.bottleMatch) : !!b.verified
      })
      setBiopsyVerified(initBio)
    }
  }, [cases.length, currentCaseId])

  const case_ = selectedCaseId ? cases.find(c => c.id === selectedCaseId) : undefined

  const allIssues = useMemo(() => {
    if (!case_) return []
    return case_.reportIssues
  }, [case_])

  if (!case_) {
    return (
      <PageLayout title="报告校对" currentKey="report-proof">
        <div className="empty-hint">
          <h3>请先选择病例</h3>
          <Button type="primary" onClick={() => openWindow('pending-list')}>返回列表</Button>
        </div>
      </PageLayout>
    )
  }

  const biopsyCheck = () => {
    const bottles = case_.biopsy.map(b => b.bottleNo)
    const bottleCounts: Record<string, number> = {}
    bottles.forEach(b => { bottleCounts[b] = (bottleCounts[b] || 0) + 1 })
    const dupBottles = Object.entries(bottleCounts).filter(([, n]) => n > 1).map(([k]) => k)
    const missingOrder = bottles.length > 0
      ? bottles.some((b, i) => {
          const n = parseInt(b.replace(/\D/g, '')) || 0
          return n !== i + 1
        })
      : false
    return { dupBottles, missingOrder, allOk: dupBottles.length === 0 && !missingOrder }
  }
  const bioCheck = biopsyCheck()

  const termCheckResult = useMemo(() => {
    const issues: { type: string; original: string; suggestion: string; note: string }[] = []
    nonStandardTerms.forEach(t => {
      if (case_.originalReport.includes(t.wrong)) {
        issues.push({
          type: '术语不规范',
          original: t.wrong,
          suggestion: t.correct,
          note: t.note
        })
      }
    })
    return issues
  }, [case_])

  const highIssues = allIssues.filter(i => i.severity === '高')
  const medIssues = allIssues.filter(i => i.severity === '中')
  const lowIssues = allIssues.filter(i => i.severity === '低')
  const fixedCount = allIssues.filter(i => i.fixed).length + Object.values(termFixed).filter(Boolean).length
  const totalIssueForFix = allIssues.length + termCheckResult.length
  const checkProgress = totalIssueForFix === 0 ? 100 : Math.round(fixedCount / totalIssueForFix * 100)

  const submitAddIssue = () => {
    form.validateFields().then(values => {
      addReportIssue(case_.id, {
        type: values.type,
        severity: values.severity,
        field: Array.isArray(values.field) ? values.field.join('/') : values.field,
        original: values.original || '',
        suggestion: values.suggestion,
        description: values.description
      })
      message.success('已添加自定义问题并保存')
      setAddIssueModal(false)
      form.resetFields()
    })
  }

  const handleBiopsyVerify = (bottleNo: string, val: boolean) => {
    const next = { ...biopsyVerified, [bottleNo]: val }
    setBiopsyVerified(next)
    setBiopsyVerification(case_.id, bottleNo, {
      bottleNo,
      siteMatch: val,
      bottleMatch: val
    })
  }

  const confirmAllChecked = () => {
    modal.confirm({
      title: '确认完成报告校对',
      content: (
        <div>
          <p>病例 <b>{case_.caseNo}</b> 报告校对即将完成。</p>
          <p>剩余未修复问题：<b style={{ color: '#ff4d4f' }}>{totalIssueForFix - fixedCount}</b> 项</p>
          <p>活检瓶核对：{bioCheck.allOk ? <Tag color="green">通过</Tag> : <Tag color="red">存在问题</Tag>}</p>
          <p>是否继续前往质控评分？</p>
        </div>
      ),
      okText: '确认并前往质控评分',
      cancelText: '继续校对',
      onOk: () => {
        setReportChecked(true)
        openWindow('qc-score', { caseId: case_.id, caseNo: case_.caseNo, patientName: case_.patient.name })
      }
    })
  }

  return (
    <PageLayout
      title="报告校对"
      currentKey="report-proof"
      subtitle={`病例 ${case_.caseNo} - ${case_.patient.name} · 报告术语一致性检查与活检瓶编号核对`}
      extra={
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => setAddIssueModal(true)}>添加问题</Button>
          <Button icon={<AuditOutlined />} onClick={() => setReportChecked(true)}>
            标记校对完成
          </Button>
          <Button type="primary" icon={<TrophyOutlined />} onClick={confirmAllChecked}>
            前往质控评分
          </Button>
        </Space>
      }
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card className="info-card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3>校对概览</h3>
            </div>
            <Row gutter={12}>
              <Col span={12}>
                <Statistic title="问题总数" value={totalIssueForFix}
                  valueStyle={{ color: totalIssueForFix === 0 ? '#52c41a' : '#ff4d4f' }} />
              </Col>
              <Col span={12}>
                <Statistic title="已处理" value={fixedCount} valueStyle={{ color: '#52c41a' }} />
              </Col>
            </Row>
            <div style={{ marginTop: 12 }}>
              <b>校对进度</b>
              <Progress percent={checkProgress} status={checkProgress === 100 ? 'success' : 'active'} />
            </div>
            <Divider />
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span><Badge status="error" /> 高风险问题</span>
                <b style={{ color: '#ff4d4f' }}>{highIssues.length}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span><Badge status="warning" /> 中风险问题</span>
                <b style={{ color: '#fa8c16' }}>{medIssues.length}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span><Badge status="default" /> 低风险问题</span>
                <b style={{ color: '#8c8c8c' }}>{lowIssues.length + termCheckResult.length}</b>
              </div>
            </Space>
          </Card>

          <Card className="info-card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3><ExperimentOutlined /> 活检瓶编号核对</h3>
              <Tag color={bioCheck.allOk ? 'green' : 'red'}>
                {bioCheck.allOk ? '通过' : '存在问题'}
              </Tag>
            </div>
            {case_.biopsy.length === 0 ? (
              <Result status="info" title="本病例无活检" />
            ) : (
              <>
                {bioCheck.dupBottles.length > 0 && (
                  <Alert type="error" showIcon
                    message="瓶号重复"
                    description={`重复瓶号：${bioCheck.dupBottles.join('、')}，请与病理申请单核对`}
                    style={{ marginBottom: 10 }}
                  />
                )}
                {bioCheck.missingOrder && (
                  <Alert type="warning" showIcon
                    message="瓶号顺序不连续"
                    description="瓶号建议按照取材顺序从1开始编号，请核对是否漏编"
                    style={{ marginBottom: 10 }}
                  />
                )}
                <Table
                  size="small"
                  rowKey="bottleNo"
                  pagination={false}
                  dataSource={case_.biopsy}
                  columns={[
                    { title: '瓶号', dataIndex: 'bottleNo', width: 90,
                      render: v => <Tag color="purple" style={{ fontFamily: 'monospace' }}>{v}</Tag> },
                    { title: '取材部位', dataIndex: 'site' },
                    { title: '块数', dataIndex: 'pieces', width: 60, align: 'center' },
                    { title: '与申请单一致', width: 100, align: 'center',
                      render: (_, r) => (
                        <Checkbox
                          checked={!!biopsyVerified[r.bottleNo]}
                          onChange={e => handleBiopsyVerify(r.bottleNo, e.target.checked)}
                        />
                      )
                    }
                  ]}
                />
                <div style={{ marginTop: 10, fontSize: 12, color: '#595959' }}>
                  <EyeOutlined /> 请逐一核对每个活检瓶：编号唯一、顺序连续、部位与申请单一致
                </div>
              </>
            )}
          </Card>

          <Card className="info-card">
            <div className="card-header">
              <h3><BookOutlined /> 标准术语参考手册</h3>
            </div>
            <List
              size="small"
              dataSource={Object.entries(termDictionary)}
              renderItem={([k, v]) => (
                <List.Item style={{ alignItems: 'flex-start' }}>
                  <List.Item.Meta
                    title={<b style={{ color: '#1677ff' }}>{k}</b>}
                    description={
                      <Space wrap size={[6, 6]} style={{ marginTop: 4 }}>
                        {v.map(t => <Tag key={t}>{t}</Tag>)}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card className="info-card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3><ExclamationCircleOutlined /> 报告问题列表
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  {allIssues.length + termCheckResult.length} 项
                </Tag>
              </h3>
            </div>
            {allIssues.length === 0 && termCheckResult.length === 0 ? (
              <Result status="success" title="未发现报告问题" subTitle="报告术语规范，结构完整" />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={[8, 8]}>
                {allIssues.map(i => (
                  <div key={i.id} className={`issue-card severity-${i.severity === '高' ? 'high' : i.severity === '中' ? 'medium' : 'low'}`}>
                    <div className="issue-header" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Checkbox
                        checked={!!i.fixed}
                        onChange={e => toggleIssueFixed(case_.id, i.id, e.target.checked)}
                      />
                      <span className="issue-type">
                        <Tag color={i.severity === '高' ? 'red' : i.severity === '中' ? 'orange' : 'default'}>{i.severity}</Tag>
                        {i.type}
                      </span>
                      <Tag color={(i.source || '系统检测') === '系统检测' ? 'blue' : 'purple'}>{i.source || '系统检测'}</Tag>
                      <span className="issue-field">【{i.field}】</span>
                      {i.source === '手动添加' && (
                        <Button size="small" type="text" danger icon={<DeleteOutlined />}
                          onClick={() => {
                            modal.confirm({
                              title: '删除问题？',
                              content: i.description,
                              okText: '永久删除',
                              okButtonProps: { danger: true },
                              onOk: () => {
                                removeReportIssue(case_.id, i.id)
                                message.success('已删除此问题')
                              }
                            })
                          }} />
                      )}
                    </div>
                    <div className="issue-desc">{i.description}</div>
                    {i.original && (
                      <div style={{ marginTop: 4, fontSize: 12 }}>
                        <span style={{ color: '#8c8c8c' }}>原文：</span>
                        <span style={{ color: '#ff4d4f', textDecoration: 'line-through' }}>{i.original}</span>
                      </div>
                    )}
                    <div className="issue-suggestion">💡 建议：{i.suggestion}</div>
                  </div>
                ))}
                {termCheckResult.map((t, idx) => (
                  <div key={`tm-${idx}`} className="issue-card severity-low">
                    <div className="issue-header">
                      <Checkbox
                        checked={!!termFixed['tm-' + idx]}
                        onChange={e => setTermFixed({ ...termFixed, ['tm-' + idx]: e.target.checked })}
                      />
                      <span className="issue-type"><Tag>低</Tag>{t.type}</span>
                      <span className="issue-field">【诊断用语】</span>
                    </div>
                    <div className="issue-desc">报告中出现非标准术语</div>
                    <div style={{ marginTop: 4, fontSize: 12 }}>
                      <span style={{ color: '#8c8c8c' }}>原文：</span>
                      <span style={{ color: '#ff4d4f', textDecoration: 'line-through' }}>{t.original}</span>
                    </div>
                    <div className="issue-suggestion">💡 建议：使用「{t.suggestion}」— {t.note}</div>
                  </div>
                ))}
              </Space>
            )}
          </Card>

          {reportChecked && (
            <Alert type="success" showIcon
              message="报告校对已完成"
              description="所有问题已逐一核对，可进入质控评分环节"
              icon={<CheckCircleOutlined />}
            />
          )}
        </Col>

        <Col xs={24} lg={8}>
          <Card className="info-card">
            <div className="card-header">
              <h3><FileTextOutlined /> 原始报告预览</h3>
              <Space>
                <Tag color="geekblue" icon={<SearchOutlined />}>
                  检测到 {termCheckResult.length} 处术语问题
                </Tag>
              </Space>
            </div>
            <div
              className="report-content"
              style={{ maxHeight: 700, overflow: 'auto' }}
              dangerouslySetInnerHTML={{
                __html: highlightIssuesInReport(case_.originalReport, nonStandardTerms)
              }}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title="新增报告问题"
        open={addIssueModal}
        onCancel={() => setAddIssueModal(false)}
        onOk={submitAddIssue}
        okText="添加问题"
        width={560}
      >
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="问题类型" name="type" rules={[{ required: true }]}>
                <Select options={[
                  { value: '术语不一致', label: '术语不一致' },
                  { value: '描述缺失', label: '描述缺失' },
                  { value: '分级错误', label: '分级错误' },
                  { value: '活检瓶编号问题', label: '活检瓶编号问题' },
                  { value: '其他', label: '其他' }
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="严重程度" name="severity" rules={[{ required: true }]}>
                <Radio.Group>
                  <Radio.Button value="高">高</Radio.Button>
                  <Radio.Button value="中">中</Radio.Button>
                  <Radio.Button value="低">低</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="问题字段" name="field" rules={[{ required: true }]}>
            <Select mode="tags" placeholder="输入字段，如：诊断/病变描述/大小...">
              <Select.Option value="诊断">诊断</Select.Option>
              <Select.Option value="病变描述">病变描述</Select.Option>
              <Select.Option value="分级分型">分级分型</Select.Option>
              <Select.Option value="活检">活检</Select.Option>
              <Select.Option value="随访建议">随访建议</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="原文摘录（选填）" name="original">
            <Input placeholder="从报告中复制的问题原文" />
          </Form.Item>
          <Form.Item label="修改建议" name="suggestion" rules={[{ required: true }]}>
            <Input placeholder="建议的规范描述" />
          </Form.Item>
          <Form.Item label="问题说明" name="description" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="请说明问题原因及依据" />
          </Form.Item>
        </Form>
      </Modal>
    </PageLayout>
  )
}

function highlightIssuesInReport(report: string, terms: { wrong: string; correct: string }[]): string {
  let html = report
    .replace(/\n/g, '<br/>')
    .replace(/^# (.+)$/gm, '<h3 style="color:#1677ff;margin:10px 0 6px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h4 style="color:#0050b3;margin:8px 0 4px">$1</h4>')
    .replace(/^### (.+)$/gm, '<b style="color:#003a8c;margin:4px 0">$1</b>')
    .replace(/^- /gm, '· ')
  terms.forEach(t => {
    const re = new RegExp(`(${t.wrong})`, 'g')
    html = html.replace(re,
      `<span style="background:#fff1f0;color:#ff4d4f;padding:1px 4px;border:1px dashed #ffa39e;border-radius:3px" title="建议改为：${t.correct}">$1</span>`)
  })
  return html
}

export default ReportProofPage
