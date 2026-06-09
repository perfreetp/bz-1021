import React, { useEffect, useMemo, useState } from 'react'
import {
  Row, Col, Card, Tag, Button, Space, Divider, Form, Input,
  Modal, App, Tooltip, Progress, Statistic, Radio, Steps,
  Alert, Result, List, Descriptions, Empty, Table
} from 'antd'
import {
  TrophyOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ExclamationCircleOutlined, SaveOutlined, SendOutlined,
  RollbackOutlined, FileTextOutlined, AuditOutlined,
  QuestionCircleOutlined, TeamOutlined, CommentOutlined,
  WarningOutlined, EditOutlined
} from '@ant-design/icons'
import PageLayout, { openWindow, getQueryParams } from '../components/PageLayout'
import { useAppStore, qcRules } from '../store/useAppStore'
import type { CaseRecord, Lesion, BiopsyItem } from '../types'

const QCScorePage: React.FC = () => {
  const { message, modal } = App.useApp()
  const {
    cases, setCurrentCase, setScore,
    setReviewComment, calculateTotalScore, submitReview,
    addDispute, resolveDispute
  } = useAppStore()
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>()
  const [disputeModal, setDisputeModal] = useState(false)
  const [disputeForm] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const params = getQueryParams()
    const id = params.caseId
    const caseList = cases
    const target = id
      ? caseList.find(c => c.id === id)
      : caseList.find(c => c.status === '待复核' || c.status === '复核中') || caseList[0]
    if (target) {
      setCurrentCase(target.id, false)
      setSelectedCaseId(target.id)
    }
  }, [cases.length])

  const case_ = selectedCaseId ? cases.find(c => c.id === selectedCaseId) : undefined

  const currentTotal = useMemo(() => (
    case_ ? calculateTotalScore(case_.id) : 0
  ), [case_, case_?.qcScores])

  const scoreLevel = useMemo(() => {
    if (currentTotal >= 90) return { label: '优秀', color: '#52c41a', pct: 95 }
    if (currentTotal >= 80) return { label: '良好', color: '#1677ff', pct: 85 }
    if (currentTotal >= 70) return { label: '合格', color: '#fa8c16', pct: 70 }
    if (currentTotal >= 60) return { label: '待改进', color: '#eb2f96', pct: 60 }
    return { label: '不合格', color: '#ff4d4f', pct: 50 }
  }, [currentTotal])

  const categoryScores = useMemo(() => {
    const cats = new Map<string, { max: number; score: number }>()
    qcRules.forEach(r => {
      if (!cats.has(r.category)) cats.set(r.category, { max: 0, score: 0 })
      const c = cats.get(r.category)!
      c.max += r.maxScore
      const caseScore = case_
        ? (case_.qcScores[r.id] ?? r.maxScore)
        : r.maxScore
      c.score += caseScore
    })
    return Array.from(cats.entries()).map(([cat, v]) => ({
      category: cat,
      maxScore: v.max,
      score: v.score,
      percent: Math.round(v.score / v.max * 100)
    }))
  }, [case_, case_?.qcScores])

  if (!case_) {
    return (
      <PageLayout title="质控评分" currentKey="qc-score">
        <div className="empty-hint">
          <h3>请先选择病例</h3>
          <Button type="primary" onClick={() => openWindow('pending-list')}>返回列表</Button>
        </div>
      </PageLayout>
    )
  }

  const caseDisputes = case_.disputes || []
  const currentComment = (case_.reviewComment || '').trim()

  const manualIssues = case_.reportIssues.filter(i => i.source === '手动添加')
  const systemIssues = case_.reportIssues.filter(i => i.source !== '手动添加')
  const gradeList = Object.entries(case_.lesionGrades || {})
  const bioList = Object.entries(case_.biopsyVerifications || {})

  const persistStorageHint = () => {
    message.success('当前评分、意见、校对依据均已自动保存在本机，关闭客户端后仍可恢复')
  }

  const handleSubmit = (status: '已通过' | '已退回' | '争议中') => {
    if (!currentComment) {
      message.warning('请先填写复核意见')
      return
    }
    if (status === '已退回' && currentComment.length < 10) {
      message.warning('退回病例需要详细说明修改理由（至少10字）')
      return
    }
    modal.confirm({
      title: status === '已通过' ? '确认通过复核' : status === '已退回' ? '确认退回修改' : '提交争议处理',
      content: (
        <div>
          <p>病例：<b>{case_.caseNo}</b>（{case_.patient.name}）</p>
          <p>操作医生：<b>{case_.doctor.name}</b>（{case_.doctor.title}）</p>
          <p>质控评分：<b style={{ color: scoreLevel.color, fontSize: 18 }}>{currentTotal}</b> / 100（{scoreLevel.label}）</p>
          <p>复核意见：{currentComment.slice(0, 80)}{currentComment.length > 80 ? '...' : ''}</p>
          <p style={{ color: '#fa8c16' }}>确认后将 {status === '已通过' ? '发布报告' : status === '已退回' ? '通知操作医生修改' : '提交科室质控组'}。</p>
        </div>
      ),
      okText: `确认${status === '已通过' ? '通过' : status === '已退回' ? '退回' : '争议'}`,
      cancelText: '再想想',
      okButtonProps: { danger: status !== '已通过' },
      onOk: () => {
        setSubmitting(true)
        setTimeout(() => {
          submitReview(case_.id, status)
          setSubmitting(false)
          message.success(
            status === '已通过'
              ? `报告已通过，质控分 ${currentTotal}，已通知操作医生`
              : status === '已退回'
                ? '已退回，操作医生将收到修改通知'
                : '已提交争议，等待质控组处理'
          )
        }, 800)
      }
    })
  }

  const openDispute = () => {
    disputeForm.resetFields()
    setDisputeModal(true)
  }

  const submitDispute = () => {
    disputeForm.validateFields().then(values => {
      addDispute(case_.id, {
        reviewer: '质控科张医生',
        reason: values.reason
      })
      setDisputeModal(false)
      message.success('争议已记录并保存')
    })
  }

  return (
    <PageLayout
      title="质控评分"
      currentKey="qc-score"
      subtitle={`病例 ${case_.caseNo} - ${case_.patient.name} · 按规则逐项评分、给出复核意见`}
      extra={
        <Space>
          <Button icon={<FileTextOutlined />} onClick={() => openWindow('case-detail', { caseId: case_.id, caseNo: case_.caseNo, patientName: case_.patient.name })}>
            返回病例详情
          </Button>
          <Button icon={<AuditOutlined />} onClick={() => openWindow('report-proof', { caseId: case_.id, caseNo: case_.caseNo, patientName: case_.patient.name })}>
            校对依据
          </Button>
          <Button icon={<SaveOutlined />} onClick={() => {
            persistStorageHint()
          }}>保存进度</Button>
        </Space>
      }
    >
      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card
            className="info-card"
            style={{
              border: '2px dashed #91caff',
              background: 'linear-gradient(135deg, #e6f4ff, #f0f5ff 40%, #fff)'
            }}
            title={
              <Space size={8}>
                <AuditOutlined style={{ color: '#1677ff', fontSize: 18 }} />
                <b style={{ fontSize: 16 }}>前期校对依据汇总</b>
                <Tag color="geekblue" style={{ marginLeft: 8 }}>
                  来自：报告校对 + 诊断建议
                </Tag>
                <Tag color="green">自动持久化</Tag>
              </Space>
            }
            extra={
              <Space wrap size={[6, 6]}>
                <Tag color="red">
                  高/中危问题 {case_.reportIssues.filter(i => i.severity !== '低').length}
                </Tag>
                <Tag color="purple">
                  手动问题 {manualIssues.length}
                </Tag>
                <Tag color="blue">
                  病灶分级 {gradeList.filter(([, g]) => g.grade).length}/{case_.lesions.length}
                </Tag>
                <Tag color="cyan">
                  活检核对 {bioList.filter(([, b]) => b.siteMatch && b.bottleMatch).length}/{case_.biopsy.length}
                </Tag>
                {case_.biopsyAssessment && (
                  <Tag color={case_.biopsyAssessment.completeness >= 80 ? 'green' : 'orange'}>
                    取材完整度 {case_.biopsyAssessment.completeness}%
                  </Tag>
                )}
              </Space>
            }
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={8}>
                <Card size="small" title={
                  <Space size={6}>
                    <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                    <b>报告校对问题（{manualIssues.length + systemIssues.length}项）</b>
                  </Space>
                } style={{ height: '100%' }}>
                  {case_.reportIssues.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未发现报告问题" />
                  ) : (
                    <div style={{ maxHeight: 220, overflow: 'auto' }}>
                      <Space direction="vertical" size={[6, 6]} style={{ width: '100%' }}>
                        {case_.reportIssues.map(i => (
                          <div key={i.id} style={{
                            padding: '8px 10px',
                            borderRadius: 6,
                            background: i.fixed ? '#f6ffed' : (i.severity === '高' ? '#fff1f0' : i.severity === '中' ? '#fff7e6' : '#fafafa'),
                            border: i.fixed ? '1px solid #b7eb8f' : (i.severity === '高' ? '1px solid #ffa39e' : i.severity === '中' ? '1px solid #ffd591' : '1px solid #f0f0f0'),
                            fontSize: 12
                          }}>
                            <Space size={[4, 4]} wrap style={{ marginBottom: 2 }}>
                              <Tag color={i.severity === '高' ? 'red' : i.severity === '中' ? 'orange' : 'default'}
                                style={{ margin: 0 }}>
                                {i.severity}
                              </Tag>
                              <Tag color={i.source === '手动添加' ? 'purple' : 'blue'} style={{ margin: 0 }}>
                                {i.source || '系统检测'}
                              </Tag>
                              {i.fixed && <Tag color="green" style={{ margin: 0 }}>已修复</Tag>}
                              <b>{i.type}</b>
                              <span style={{ color: '#8c8c8c' }}>【{i.field}】</span>
                            </Space>
                            <div style={{ color: '#595959', lineHeight: 1.6 }}>{i.description}</div>
                            {i.suggestion && (
                              <div style={{ color: '#1677ff', marginTop: 2, lineHeight: 1.5 }}>
                                💡 {i.suggestion}
                              </div>
                            )}
                          </div>
                        ))}
                      </Space>
                    </div>
                  )}
                  {manualIssues.length > 0 && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #f0f0f0', fontSize: 12, color: '#722ed1' }}>
                      <QuestionCircleOutlined /> 其中 {manualIssues.length} 项为质控医生在【报告校对】中手动补充，可作为扣分依据
                    </div>
                  )}
                </Card>
              </Col>
              <Col xs={24} lg={8}>
                <Card size="small" title={
                  <Space size={6}>
                    <EditOutlined style={{ color: '#722ed1' }} />
                    <b>病灶分级摘要（{gradeList.filter(([, g]) => g.grade).length}/{case_.lesions.length}）</b>
                  </Space>
                } style={{ height: '100%' }}>
                  {case_.lesions.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未发现病灶" />
                  ) : (
                    <Table
                      size="small"
                      pagination={false}
                      dataSource={case_.lesions}
                      rowKey="id"
                      columns={[
                        {
                          title: '病灶', dataIndex: 'type', width: 60,
                          render: (t: string) => <b>{t}</b>
                        },
                        { title: '部位', dataIndex: 'location', width: 80 },
                        {
                          title: '大小', width: 60,
                          render: (_v: unknown, l: Lesion) => {
                            const g = case_.lesionGrades?.[l.id]
                            return g?.sizeMm ? `${g.sizeMm}mm` : l.size
                          }
                        },
                        {
                          title: '分级', width: 110,
                          render: (_v: unknown, l: Lesion) => {
                            const g = case_.lesionGrades?.[l.id]
                            const grade = g?.grade
                            return grade ? (
                              <Tag color={grade.includes('Ⅲ') || grade.includes('进展') || grade.includes('T2') || grade.includes('重度') ? 'red' : 'blue'}>
                                {grade}
                              </Tag>
                            ) : (
                              <Tag color="default">未填写</Tag>
                            )
                          }
                        },
                        {
                          title: '活检建议', width: 70, align: 'center',
                          render: (_v: unknown, l: Lesion) => {
                            const g = case_.lesionGrades?.[l.id]
                            return g?.biopsyRecommended
                              ? <Tag color="red">需要{g.requiredPieces ? `（≥${g.requiredPieces}块）` : ''}</Tag>
                              : <Tag color="default">不需要</Tag>
                          }
                        },
                        {
                          title: '备注',
                          render: (_v: unknown, l: Lesion) => {
                            const g = case_.lesionGrades?.[l.id]
                            return g?.remark || (l.isSuspicious ? '⚠️ AI标注疑似' : '-')
                          }
                        }
                      ]}
                    />
                  )}
                  {gradeList.filter(([, g]) => g.grade).length < case_.lesions.length && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #f0f0f0', fontSize: 12, color: '#fa8c16' }}>
                      <WarningOutlined /> 有 {case_.lesions.length - gradeList.filter(([, g]) => g.grade).length} 处病灶尚未完成分级，建议在【诊断建议】中补充，评分时参考
                    </div>
                  )}
                </Card>
              </Col>
              <Col xs={24} lg={8}>
                <Card size="small" title={
                  <Space size={6}>
                    <TrophyOutlined style={{ color: '#1677ff' }} />
                    <b>活检核对与取材评估</b>
                  </Space>
                } style={{ height: '100%' }}>
                  {case_.biopsy.length === 0 ? (
                    <div>
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本病例无活检" />
                      <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c', textAlign: 'center' }}>
                        如存在可疑病变但未取活检，可作为【病变识别】维度扣分依据
                      </div>
                    </div>
                  ) : (
                    <>
                      <Table
                        size="small"
                        pagination={false}
                        rowKey="bottleNo"
                        dataSource={case_.biopsy}
                        columns={[
                          {
                            title: '瓶号', dataIndex: 'bottleNo', width: 60,
                            render: (v: string) => <Tag color="purple">{v}</Tag>
                          },
                          { title: '部位', dataIndex: 'site', width: 80 },
                          { title: '块数', dataIndex: 'pieces', width: 50, align: 'center' },
                          {
                            title: '部位匹配', width: 70, align: 'center',
                            render: (_v: unknown, b: BiopsyItem) => {
                              const v = case_.biopsyVerifications?.[b.bottleNo]
                              return v?.siteMatch
                                ? <Tag color="green">✓</Tag>
                                : <Tag color="red">✗</Tag>
                            }
                          },
                          {
                            title: '瓶号匹配', width: 70, align: 'center',
                            render: (_v: unknown, b: BiopsyItem) => {
                              const v = case_.biopsyVerifications?.[b.bottleNo]
                              return v?.bottleMatch
                                ? <Tag color="green">✓</Tag>
                                : <Tag color="red">✗</Tag>
                            }
                          }
                        ]}
                      />
                      {case_.biopsyAssessment && (
                        <>
                          <Divider style={{ margin: '12px 0' }} />
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                              <b>取材完整度评估</b>
                              <span>{case_.biopsyAssessment.completeness}%</span>
                            </div>
                            <Progress
                              percent={case_.biopsyAssessment.completeness}
                              size="small"
                              status={case_.biopsyAssessment.verified
                                ? (case_.biopsyAssessment.completeness >= 80 ? 'success' : 'active')
                                : 'exception'}
                            />
                          </div>
                          {case_.biopsyAssessment.warnings.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <Alert
                                type="warning" showIcon
                                icon={<WarningOutlined />}
                                message="取材警告"
                                description={
                                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                                    {case_.biopsyAssessment.warnings.map((w, i) => <li key={i}>{w}</li>)}
                                  </ul>
                                }
                              />
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #f0f0f0', fontSize: 12, color: '#8c8c8c', textAlign: 'center' }}>
                    以上数据来自【诊断建议】页的保存结果，刷新或关闭客户端后仍保留
                  </div>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card className="info-card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3><TrophyOutlined /> 质控总评分</h3>
              <Tag color={scoreLevel.color === '#52c41a' ? 'green'
                : scoreLevel.color === '#1677ff' ? 'blue'
                  : scoreLevel.color === '#fa8c16' ? 'orange' : 'red'}>
                {scoreLevel.label}
              </Tag>
            </div>
            <div style={{ textAlign: 'center', padding: '10px 0 16px' }}>
              <Progress
                type="dashboard"
                percent={scoreLevel.pct}
                strokeColor={scoreLevel.color}
                size={180}
                format={() => (
                  <div style={{ lineHeight: 1.3 }}>
                    <div style={{ fontSize: 42, fontWeight: 700, color: scoreLevel.color }}>
                      {currentTotal}
                    </div>
                    <div style={{ fontSize: 14, color: '#8c8c8c' }}>总分 / 100</div>
                  </div>
                )}
              />
            </div>
            <Steps direction="vertical" size="small" current={
              currentTotal >= 90 ? 4 : currentTotal >= 80 ? 3 : currentTotal >= 70 ? 2 : currentTotal >= 60 ? 1 : 0
            } items={[
              { title: '≥90 优秀', description: '报告规范准确' },
              { title: '≥80 良好', description: '轻微问题，不影响发布' },
              { title: '≥70 合格', description: '部分问题需改进' },
              { title: '≥60 待改进', description: '建议退回修改' },
              { title: '<60 不合格', description: '必须退回重写' }
            ]} />
          </Card>

          <Card className="info-card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3>各维度得分</h3>
            </div>
            <Space direction="vertical" style={{ width: '100%' }} size={[10, 10]}>
              {categoryScores.map(c => (
                <div key={c.category}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <b>{c.category}</b>
                    <span className={`score-cell ${c.percent >= 90 ? 'full' : c.percent >= 80 ? 'good' : c.percent >= 70 ? 'warn' : 'poor'}`}>
                      {c.score} / {c.maxScore}
                    </span>
                  </div>
                  <Progress percent={c.percent} size="small" showInfo={false}
                    strokeColor={c.percent >= 90 ? '#52c41a' : c.percent >= 80 ? '#1677ff' : c.percent >= 70 ? '#fa8c16' : '#ff4d4f'} />
                </div>
              ))}
            </Space>
          </Card>

          <Card className="info-card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3><FileTextOutlined /> 病例信息摘要</h3>
            </div>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="病例编号">{case_.caseNo}</Descriptions.Item>
              <Descriptions.Item label="患者">{case_.patient.name}（{case_.patient.gender}/{case_.patient.age}岁）</Descriptions.Item>
              <Descriptions.Item label="检查类型">{case_.examType}</Descriptions.Item>
              <Descriptions.Item label="操作医生">{case_.doctor.name}（{case_.doctor.title}）</Descriptions.Item>
              <Descriptions.Item label="检查日期">{case_.examDate}</Descriptions.Item>
              <Descriptions.Item label="主要诊断">{case_.diagnosis}</Descriptions.Item>
              <Descriptions.Item label="当前状态">
                <Tag color={
                  case_.status === '已通过' ? 'green'
                    : case_.status === '已退回' ? 'red'
                      : case_.status === '争议中' ? 'purple'
                        : case_.status === '复核中' ? 'blue' : 'orange'
                }>{case_.status}</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {caseDisputes.length > 0 && (
            <Card className="info-card" style={{ border: '1px solid #d3adf7', background: 'linear-gradient(135deg, #f9f0ff, #fff)' }}>
              <div className="card-header">
                <h3><ExclamationCircleOutlined style={{ color: '#722ed1' }} /> 争议记录（{caseDisputes.length}）</h3>
              </div>
              <List
                size="small"
                dataSource={caseDisputes}
                renderItem={d => (
                  <List.Item style={{ alignItems: 'flex-start' }}>
                    <List.Item.Meta
                      avatar={d.status === '已解决' ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        : d.status === '升级处理' ? <WarningOutlined style={{ color: '#fa8c16' }} />
                          : <QuestionCircleOutlined style={{ color: '#722ed1' }} />}
                      title={
                        <Space>
                          <b>{d.reviewer}</b>
                          <Tag color={d.status === '已解决' ? 'green' : d.status === '升级处理' ? 'orange' : 'purple'}>
                            {d.status}
                          </Tag>
                          <span style={{ fontSize: 12, color: '#8c8c8c' }}>{d.timestamp}</span>
                        </Space>
                      }
                      description={
                        <div>
                          <div><b>原因：</b>{d.reason}</div>
                          {d.resolution && <div style={{ color: '#52c41a', marginTop: 4 }}>✅ {d.resolution}</div>}
                        </div>
                      }
                    />
                    {d.status !== '已解决' && (
                      <Button size="small" type="link" onClick={() => {
                        let inputValue = ''
                        modal.confirm({
                          title: '解决争议',
                          content: (
                            <Input.TextArea
                              rows={3}
                              placeholder="请输入处理结果..."
                              onChange={e => { inputValue = e.target.value }}
                              style={{ marginTop: 12 }}
                            />
                          ),
                          okText: '确认解决',
                          onOk: () => {
                            if (!inputValue.trim()) return Promise.reject()
                            resolveDispute(case_.id, d.id, inputValue.trim())
                            message.success('已解决')
                          }
                        })
                      }}>
                        标记解决
                      </Button>
                    )}
                  </List.Item>
                )}
              />
            </Card>
          )}
        </Col>

        <Col xs={24} lg={16}>
          <Card className="info-card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3><AuditOutlined /> 逐项评分（共 {qcRules.length} 项）</h3>
              <Space>
                <Button size="small" onClick={() => {
                  qcRules.forEach(r => setScore(case_.id, r.id, r.maxScore))
                  message.success('已全部给满分')
                }}>全部满分</Button>
                <Tooltip title="每项扣减20%">
                  <Button size="small" onClick={() => {
                    qcRules.forEach(r => setScore(case_.id, r.id, Math.round(r.maxScore * 0.8)))
                    message.success('已按80%评分')
                  }}>标准化扣减</Button>
                </Tooltip>
              </Space>
            </div>
            <Row gutter={[16, 16]}>
              {qcRules.map(r => {
                const currentScore = (case_.qcScores[r.id] ?? r.maxScore)
                const deduction = r.maxScore - currentScore
                return (
                  <Col xs={24} md={12} xl={8} key={r.id}>
                    <Card
                      size="small"
                      style={{
                        borderRadius: 8,
                        border: deduction === 0 ? '1px solid #b7eb8f' : deduction <= r.maxScore * 0.3 ? '1px solid #f0f0f0' : '1px solid #ffa39e',
                        background: deduction === 0 ? 'linear-gradient(135deg, #f6ffed, #fff)' : undefined
                      }}
                      title={
                        <Space>
                          <Tag color={
                            r.category.includes('准备') ? 'geekblue'
                              : r.category.includes('操作') ? 'blue'
                                : r.category.includes('识别') ? 'cyan'
                                  : r.category.includes('活检') ? 'purple'
                                    : r.category.includes('报告') ? 'magenta' : 'volcano'
                          }>{r.category}</Tag>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{r.item}</span>
                        </Space>
                      }
                      extra={
                        <span className={`score-cell ${deduction === 0 ? 'full' : deduction <= r.maxScore * 0.3 ? 'good' : deduction <= r.maxScore * 0.5 ? 'warn' : 'poor'}`}>
                          {currentScore} / {r.maxScore}
                          {deduction > 0 && <span style={{ color: '#ff4d4f', marginLeft: 4, fontSize: 11 }}> -{deduction}</span>}
                        </span>
                      }
                    >
                      <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8, minHeight: 32 }}>
                        {r.description}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                        <Progress type="line"
                          percent={Math.round(currentScore / r.maxScore * 100)}
                          size="small" showInfo={false}
                          strokeColor={deduction === 0 ? '#52c41a' : deduction <= r.maxScore * 0.3 ? '#1677ff' : '#fa8c16'} />
                      </div>
                      <Radio.Group
                        size="small"
                        value={currentScore}
                        onChange={e => setScore(case_.id, r.id, e.target.value)}
                        style={{ display: 'flex', justifyContent: 'center' }}
                      >
                        {[...Array(r.maxScore + 1)].map((_, i) => {
                          const step = Math.max(1, Math.round(r.maxScore / 5))
                          if (i % step !== 0 && i !== r.maxScore) return null
                          return (
                            <Radio.Button key={i} value={i} style={{ padding: '0 6px', fontSize: 12, minWidth: 28, textAlign: 'center' }}>
                              {i}
                            </Radio.Button>
                          )
                        })}
                      </Radio.Group>
                    </Card>
                  </Col>
                )
              })}
            </Row>
          </Card>

          <Card className="info-card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3><CommentOutlined /> 复核意见
                {currentComment && <Tag color="green" style={{ marginLeft: 8 }}>已填写（{currentComment.length}字）</Tag>}
              </h3>
            </div>
            {case_.reportIssues.length > 0 && (
              <Alert
                style={{ marginBottom: 12 }}
                type="warning" showIcon
                message={`报告存在 ${case_.reportIssues.length} 项问题，请在复核意见中说明`}
                description={
                  <Space wrap size={[6, 6]}>
                    {case_.reportIssues.map(i => (
                      <Tag key={i.id} color={i.severity === '高' ? 'red' : i.severity === '中' ? 'orange' : 'default'}>
                        {i.type}：{i.field}
                      </Tag>
                    ))}
                  </Space>
                }
              />
            )}
            <Form layout="vertical">
              <Form.Item
                label="复核意见"
                required
                tooltip="请填写综合评价、扣分原因、后续建议等"
              >
                <Input.TextArea
                  rows={6}
                  maxLength={500}
                  showCount
                  value={case_.reviewComment ?? ''}
                  onChange={e => setReviewComment(case_.id, e.target.value)}
                  placeholder="请输入复核意见：包括综合评价、存在问题、扣分理由、是否建议退回修改、后续处理建议等..."
                />
              </Form.Item>
            </Form>
            <Space wrap style={{ marginTop: 4 }}>
              {[
                '报告规范完整，诊断准确，质控评分合格，同意发布。',
                '整体尚可，存在以下问题需操作医生注意：1）报告术语需更规范；2）关键帧留图需补全。建议通过。',
                '存在明显问题，需退回修改：活检记录不完整、息肉分型未说明、随访建议缺失。',
                '诊断分级存在争议，建议提交科室质控组讨论。'
              ].map((tpl, i) => (
                <Tag key={i} color="blue" style={{ cursor: 'pointer', padding: '4px 10px' }}
                  onClick={() => setReviewComment(case_.id, tpl)}>
                  快捷回复{i + 1}
                </Tag>
              ))}
            </Space>
          </Card>

          <Card
            className="info-card"
            style={{
              background: currentTotal >= 70 ? 'linear-gradient(135deg, #f6ffed, #fff)' : 'linear-gradient(135deg, #fff1f0, #fff)',
              border: currentTotal >= 70 ? '1px solid #b7eb8f' : '1px solid #ffa39e'
            }}
          >
            <div className="card-header">
              <h3><SendOutlined /> 提交复核结果</h3>
              <Tag color={currentTotal >= 70 ? 'green' : 'red'}>
                建议：{currentTotal >= 80 ? '通过' : currentTotal >= 70 ? '有条件通过' : currentTotal >= 60 ? '退回修改' : '必须退回'}
              </Tag>
            </div>
            <Row gutter={[12, 12]}>
              <Col xs={24} md={8}>
                <Button
                  type="primary"
                  size="large"
                  block
                  icon={<CheckCircleOutlined />}
                  loading={submitting}
                  onClick={() => handleSubmit('已通过')}
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                >
                  复核通过
                </Button>
                <div style={{ textAlign: 'center', color: '#52c41a', fontSize: 12, marginTop: 4 }}>
                  报告发布，通知操作医生
                </div>
              </Col>
              <Col xs={24} md={8}>
                <Button
                  size="large"
                  block
                  danger
                  icon={<RollbackOutlined />}
                  loading={submitting}
                  onClick={() => handleSubmit('已退回')}
                >
                  退回修改
                </Button>
                <div style={{ textAlign: 'center', color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>
                  操作医生将收到修改通知
                </div>
              </Col>
              <Col xs={24} md={8}>
                <Button
                  size="large"
                  block
                  type="primary"
                  icon={<TeamOutlined />}
                  loading={submitting}
                  onClick={() => {
                    if (!currentComment) { message.warning('请填写复核意见'); return }
                    openDispute()
                  }}
                  style={{ background: '#722ed1', borderColor: '#722ed1' }}
                >
                  提交争议
                </Button>
                <div style={{ textAlign: 'center', color: '#722ed1', fontSize: 12, marginTop: 4 }}>
                  提交质控组讨论处理
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Modal
        title="登记争议原因"
        open={disputeModal}
        onCancel={() => setDisputeModal(false)}
        onOk={submitDispute}
        okText="提交争议"
        width={520}
        okButtonProps={{ danger: false, style: { background: '#722ed1', borderColor: '#722ed1' } }}
      >
        <Form form={disputeForm} layout="vertical">
          <Form.Item label="争议原因" name="reason" rules={[{ required: true, message: '请输入争议原因' }]}>
            <Input.TextArea
              rows={5}
              showCount
              maxLength={300}
              placeholder="请详细描述争议内容：如诊断分级判断差异、病变性质分歧、治疗方案选择等"
            />
          </Form.Item>
        </Form>
      </Modal>
    </PageLayout>
  )
}

export default QCScorePage
