import React, { useEffect, useMemo, useState } from 'react'
import {
  Row, Col, Card, Form, Select, Input, InputNumber, Button, Space,
  Tag, Divider, List, Alert, Progress, App, Tooltip, Radio, Checkbox,
  Statistic, Table, Descriptions, Modal, Badge, Steps, Result
} from 'antd'
import {
  BulbOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  CloseCircleOutlined, WarningOutlined, QuestionCircleOutlined,
  FileSearchOutlined, PlusOutlined, DeleteOutlined, SaveOutlined,
  TrophyOutlined, ExperimentOutlined, MedicineBoxOutlined
} from '@ant-design/icons'
import PageLayout, { openWindow, getQueryParams } from '../components/PageLayout'
import { useAppStore } from '../store/useAppStore'
import type { LesionType, PolypGrade, InflammationGrade, UlcerStage } from '../types'

type BiopsyRequirement = {
  needBiopsy: boolean
  requiredPieces: number
  reason: string
}

const DiagnosisPage: React.FC = () => {
  const { message } = App.useApp()
  const { cases, setCurrentCase, setLesionGrade, setBiopsyVerification, setBiopsyAssessment, getCurrentCase } = useAppStore()
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>()
  const [lesionGrades, setLesionGrades] = useState<Record<string, {
    grade: string; size?: number; parisType?: PolypGrade; inflLevel?: InflammationGrade; ulcerStage?: UlcerStage; marginClear?: boolean; biopsyRecommended?: BiopsyRequirement
  }>>({})
  const [biopsyChecks, setBiopsyChecks] = useState<Record<string, {
    siteMatch: boolean; enoughPieces: boolean; bottleMatch: boolean; description: string
  }>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const params = getQueryParams()
    const id = params.caseId
    const caseList = cases
    const target = id
      ? caseList.find(c => c.id === id)
      : caseList.find(c => c.lesions.length > 0) || caseList[0]
    if (target) {
      setCurrentCase(target.id, false)
      setSelectedCaseId(target.id)
      const initGrades: Record<string, any> = {}
      target.lesions.forEach(l => {
        const persisted = target.lesionGrades?.[l.id]
        if (persisted) {
          initGrades[l.id] = {
            grade: persisted.grade,
            size: persisted.sizeMm,
            biopsyRecommended: persisted.biopsyRecommended !== undefined
              ? {
                  needBiopsy: persisted.biopsyRecommended,
                  requiredPieces: persisted.requiredPieces || 2,
                  reason: persisted.remark || ''
                }
              : undefined
          }
        } else {
          initGrades[l.id] = { grade: l.grade || '' }
        }
        if (l.type === '息肉' && !initGrades[l.id].grade) initGrades[l.id].parisType = 'Ⅰ型'
        if (l.type === '炎症' && !initGrades[l.id].grade) initGrades[l.id].inflLevel = '轻度'
        if (l.type === '溃疡' && !initGrades[l.id].grade) initGrades[l.id].ulcerStage = '活动期(A1/A2)'
      })
      setLesionGrades(initGrades)
      const initBio: Record<string, any> = {}
      target.biopsy.forEach(b => {
        const persisted = target.biopsyVerifications?.[b.bottleNo]
        initBio[b.bottleNo] = persisted
          ? { ...persisted, description: '' }
          : { siteMatch: !!b.verified, enoughPieces: true, bottleMatch: !!b.verified, description: '' }
      })
      setBiopsyChecks(initBio)
    }
  }, [cases.length])

  const case_ = selectedCaseId ? cases.find(c => c.id === selectedCaseId) : undefined

  const biopsyAnalysis = useMemo(() => {
    if (!case_) return { total: 0, done: 0, needed: 0, warning: [] as string[], complete: false }
    const recommendedCount = case_.lesions.filter(l =>
      ['肿瘤', '溃疡', '息肉'].includes(l.type)
    ).length
    const takenCount = case_.biopsy.length
    const totalPiecesNeeded = recommendedCount * 2
    const totalPiecesTaken = case_.biopsy.reduce((s, b) => s + b.pieces, 0)
    const warnings: string[] = []
    if (recommendedCount > takenCount) {
      warnings.push(`建议对 ${recommendedCount} 处病变取活检，当前仅 ${takenCount} 处，取材部位可能不完整`)
    }
    if (totalPiecesNeeded > totalPiecesTaken) {
      warnings.push(`建议至少取 ${totalPiecesNeeded} 块组织，当前仅 ${totalPiecesTaken} 块，每处建议≥2块`)
    }
    case_.lesions.forEach(l => {
      if (['肿瘤', '溃疡'].includes(l.type) && !case_.biopsy.some(b => b.site.includes(l.location.slice(0, 4)))) {
        warnings.push(`${l.type}（${l.location}）未见对应活检部位记录，建议补充`)
      }
    })
    return {
      total: recommendedCount,
      done: takenCount,
      needed: totalPiecesNeeded,
      taken: totalPiecesTaken,
      warning: warnings,
      complete: warnings.length === 0
    }
  }, [case_])

  if (!case_) {
    return (
      <PageLayout title="诊断建议" currentKey="diagnosis">
        <div className="empty-hint">
          <h3>请先选择病例</h3>
          <Button type="primary" onClick={() => openWindow('pending-list')}>返回列表</Button>
        </div>
      </PageLayout>
    )
  }

  const gradeOptions: Record<LesionType, { value: string; label: string; desc: string }[]> = {
    '息肉': [
      { value: 'Ⅰ型', label: 'Paris Ⅰ型（有蒂）', desc: '带蒂息肉，基底较窄' },
      { value: 'Ⅱa型', label: 'Paris Ⅱa型（表浅隆起）', desc: '轻微隆起，高度<2.5mm' },
      { value: 'Ⅱb型', label: 'Paris Ⅱb型（平坦）', desc: '完全平坦，与周围黏膜平齐' },
      { value: 'Ⅱc型', label: 'Paris Ⅱc型（表浅凹陷）', desc: '轻微凹陷型' },
      { value: 'Ⅲ型', label: 'Paris Ⅲ型（溃疡型）', desc: '明显凹陷或溃疡型' }
    ],
    '炎症': [
      { value: '轻度', label: '轻度炎症', desc: '局部充血水肿，无糜烂' },
      { value: '中度', label: '中度炎症', desc: '弥漫性充血，可见点状糜烂' },
      { value: '重度', label: '重度炎症', desc: '明显充血水肿、糜烂，接触性出血' }
    ],
    '溃疡': [
      { value: '活动期(A1/A2)', label: '活动期 A1/A2', desc: '厚苔，边界不清，周围炎症明显' },
      { value: '愈合期(H1/H2)', label: '愈合期 H1/H2', desc: '薄苔，边界清晰，再生黏膜形成' },
      { value: '瘢痕期(S1/S2)', label: '瘢痕期 S1/S2', desc: '无苔，红色/白色瘢痕形成' }
    ],
    '肿瘤': [
      { value: '早期（T1）', label: '早期病变（T1）', desc: '局限于黏膜层/黏膜下层' },
      { value: '进展期（T2+）', label: '进展期（T2+）', desc: '侵犯肌层及以上' }
    ],
    '血管畸形': [
      { value: 'GAVE', label: 'GAVE（胃窦血管扩张）', desc: '西瓜胃表现' },
      { value: 'AVM', label: 'AVM（动静脉畸形）', desc: '动静脉异常吻合' },
      { value: '毛细血管扩张', label: '毛细血管扩张', desc: '毛细血管异常扩张' }
    ],
    '其他': [
      { value: '未见明显异常', label: '未见明显异常', desc: '' }
    ]
  }

  const lesionCompletion = (lid: string) => {
    const g = lesionGrades[lid] || {}
    let filled = 0, total = 2
    if (g.grade) filled++
    if (g.biopsyRecommended) filled++
    return { filled, total, percent: Math.round(filled / total * 100) }
  }

  const saveAll = () => {
    if (!case_) return
    case_.lesions.forEach(l => {
      const g = lesionGrades[l.id]
      if (g) {
        setLesionGrade(case_.id, l.id, {
          lesionId: l.id,
          grade: g.grade || '',
          sizeMm: g.size,
          biopsyRecommended: g.biopsyRecommended?.needBiopsy,
          requiredPieces: g.biopsyRecommended?.requiredPieces,
          remark: g.biopsyRecommended?.reason
        })
      }
    })
    case_.biopsy.forEach(b => {
      const c = biopsyChecks[b.bottleNo]
      if (c) {
        setBiopsyVerification(case_.id, b.bottleNo, {
          bottleNo: b.bottleNo,
          siteMatch: c.siteMatch,
          bottleMatch: c.bottleMatch,
          enoughPieces: c.enoughPieces
        })
      }
    })
    const completeness = Math.min(100, Math.round(
      ((biopsyAnalysis.done / Math.max(1, biopsyAnalysis.total)) * 50 +
        (Math.min(1, (biopsyAnalysis.taken ?? 0) / Math.max(1, biopsyAnalysis.needed))) * 50)
    ))
    setBiopsyAssessment(case_.id, {
      completeness,
      warnings: biopsyAnalysis.warning,
      verified: Object.values(biopsyChecks).every(b => b.siteMatch && b.bottleMatch)
    })
    message.success(`病例 ${case_.caseNo} 诊断分级与取材评估已保存并持久化`)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const generateSuggestions = () => {
    const items: { type: 'success' | 'warning' | 'error' | 'info'; title: string; content: string }[] = []
    biopsyAnalysis.warning.forEach(w => items.push({ type: 'warning', title: '取材问题', content: w }))
    case_.lesions.forEach(l => {
      const grade = lesionGrades[l.id]?.grade || l.grade
      if (!grade) items.push({ type: 'error', title: '分级缺失', content: `${l.type}（${l.location}）未选择分级，建议补充` })
      if (l.isSuspicious) items.push({ type: 'warning', title: '疑似病变', content: `${l.location}的${l.type}形态可疑，建议NBI/放大内镜进一步观察` })
      if (l.type === '肿瘤') items.push({ type: 'info', title: '肿瘤评估', content: `建议完善超声内镜判断浸润深度，评估EMR/ESD/手术可行性` })
      if (l.type === '息肉' && grade === 'Ⅱc型') items.push({ type: 'warning', title: '凹陷型息肉', content: '凹陷型息肉恶变风险较高，建议完整切除后送病理' })
    })
    return items
  }

  const suggestions = generateSuggestions()

  return (
    <PageLayout
      title="诊断建议"
      currentKey="diagnosis"
      subtitle={`病例 ${case_.caseNo} - ${case_.patient.name} · 病灶分级补充与取材完整性核查`}
      extra={
        <Space>
          {saved && <Tag icon={<CheckCircleOutlined />} color="green">已保存</Tag>}
          <Button icon={<SaveOutlined />} onClick={saveAll}>保存评估</Button>
          <Button type="primary" icon={<TrophyOutlined />} onClick={() => openWindow('qc-score', { caseId: case_.id, caseNo: case_.caseNo, patientName: case_.patient.name })}>
            前往质控评分
          </Button>
        </Space>
      }
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card className="info-card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3><FileSearchOutlined /> 取材完整性评估</h3>
              <Tag color={biopsyAnalysis.complete ? 'green' : 'orange'}>
                {biopsyAnalysis.complete ? '取材完整' : '需注意'}
              </Tag>
            </div>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title="需活检病灶数" value={biopsyAnalysis.total} suffix="处" />
              </Col>
              <Col span={8}>
                <Statistic title="已取活检数" value={biopsyAnalysis.done} suffix="处"
                  valueStyle={{ color: biopsyAnalysis.done >= biopsyAnalysis.total ? '#52c41a' : '#fa8c16' }} />
              </Col>
              <Col span={8}>
                <Statistic title="组织块数"
                  value={`${biopsyAnalysis.taken ?? 0}/${biopsyAnalysis.needed}`}
                  suffix="块"
                  valueStyle={{ color: (biopsyAnalysis.taken ?? 0) >= biopsyAnalysis.needed ? '#52c41a' : '#ff4d4f' }} />
              </Col>
            </Row>
            <Divider />
            <div>
              <b>取材完整度：</b>
              <Progress
                percent={Math.min(100, Math.round(
                  ((biopsyAnalysis.done / Math.max(1, biopsyAnalysis.total)) * 50 +
                    (Math.min(1, (biopsyAnalysis.taken ?? 0) / Math.max(1, biopsyAnalysis.needed))) * 50)
                ))}
                status={biopsyAnalysis.complete ? 'success' : 'active'}
              />
            </div>
            {biopsyAnalysis.warning.length > 0 && (
              <>
                <Divider />
                <Alert
                  type="warning"
                  showIcon
                  icon={<WarningOutlined />}
                  message="取材问题提示"
                  description={
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {biopsyAnalysis.warning.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  }
                />
              </>
            )}
          </Card>

          <Card className="info-card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3><ExperimentOutlined /> 活检标本核查</h3>
              <Tag color="blue">{case_.biopsy.length} 处 / {case_.biopsy.reduce((s, b) => s + b.pieces, 0)} 块</Tag>
            </div>
            {case_.biopsy.length === 0 ? (
              <div className="empty-hint">无活检记录</div>
            ) : (
              <Table
                size="small"
                rowKey="bottleNo"
                pagination={false}
                dataSource={case_.biopsy}
                columns={[
                  { title: '瓶号', dataIndex: 'bottleNo', width: 90,
                    render: v => <Tag color="purple" style={{ fontFamily: 'monospace' }}>{v}</Tag> },
                  { title: '取材部位', dataIndex: 'site' },
                  { title: '块数', dataIndex: 'pieces', width: 70, align: 'center' },
                  {
                    title: '部位与申请单一致', width: 110, align: 'center',
                    render: (_, r) => (
                      <Checkbox
                        checked={biopsyChecks[r.bottleNo]?.siteMatch}
                        onChange={e => setBiopsyChecks({
                          ...biopsyChecks,
                          [r.bottleNo]: { ...(biopsyChecks[r.bottleNo] || {}), siteMatch: e.target.checked }
                        })}
                      />
                    )
                  },
                  {
                    title: '瓶号匹配', width: 100, align: 'center',
                    render: (_, r) => (
                      <Checkbox
                        checked={biopsyChecks[r.bottleNo]?.bottleMatch}
                        onChange={e => setBiopsyChecks({
                          ...biopsyChecks,
                          [r.bottleNo]: { ...(biopsyChecks[r.bottleNo] || {}), bottleMatch: e.target.checked }
                        })}
                      />
                    )
                  }
                ]}
              />
            )}
            <div style={{ marginTop: 16 }}>
              <Alert
                type={Object.values(biopsyChecks).every(b => b.siteMatch && b.bottleMatch) ? 'success' : 'info'}
                showIcon
                message={
                  Object.values(biopsyChecks).every(b => b.siteMatch && b.bottleMatch)
                    ? '活检标本与瓶号全部核对无误'
                    : '请逐项核对活检部位与瓶号是否与病理申请单一致'
                }
              />
            </div>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card className="info-card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3><BulbOutlined /> AI 辅助诊断建议</h3>
            </div>
            <List
              size="small"
              dataSource={suggestions}
              locale={{ emptyText: '暂无特殊提示' }}
              renderItem={(s, i) => (
                <List.Item style={{ alignItems: 'flex-start' }}>
                  <Alert
                    style={{ width: '100%' }}
                    type={s.type}
                    showIcon
                    message={<Space><Badge count={i + 1} /><b>{s.title}</b></Space>}
                    description={s.content}
                  />
                </List.Item>
              )}
            />
          </Card>

          <Card className="info-card">
            <div className="card-header">
              <h3><MedicineBoxOutlined /> 综合诊疗建议</h3>
            </div>
            <Steps
              direction="vertical"
              size="small"
              current={3}
              items={[
                {
                  title: '内镜检查',
                  description: `操作医生 ${case_.doctor.name}，${case_.startTime}-${case_.endTime}，过程顺利`,
                  status: 'finish'
                },
                {
                  title: '病灶识别',
                  description: `发现 ${case_.lesions.length} 处异常${case_.biopsy.length > 0 ? `，取活检 ${case_.biopsy.length} 处` : ''}`,
                  status: 'finish',
                  subTitle: case_.lesions.map(l => `${l.type}@${l.location}`).join('、')
                },
                {
                  title: '分级评估',
                  description: '请完成各病灶的分型/分级选择',
                  status: 'process'
                },
                {
                  title: '后续建议',
                  description: generateFollowUpSuggestion(case_, lesionGrades),
                  status: 'wait'
                }
              ]}
            />
          </Card>
        </Col>

        <Col xs={24}>
          <Card className="info-card">
            <div className="card-header">
              <h3><EditOutlinedIcon /> 病灶分级补充（共 {case_.lesions.length} 处）</h3>
              <Space>
                <Button size="small" icon={<CheckCircleOutlined />} onClick={() => message.success('已标记全部为已复核')}>
                  全部复核通过
                </Button>
              </Space>
            </div>
            {case_.lesions.length === 0 ? (
              <Result status="success" title="未发现病灶" subTitle="无需要分级的病变" />
            ) : (
              <Row gutter={[16, 16]}>
                {case_.lesions.map((l, idx) => {
                  const g = lesionGrades[l.id] || {}
                  const progress = lesionCompletion(l.id)
                  return (
                    <Col xs={24} lg={12} xl={8} key={l.id}>
                      <Card
                        size="small"
                        style={{
                          border: l.isSuspicious ? '1px solid #ffa39e' : '1px solid #f0f0f0',
                          background: l.isSuspicious ? 'linear-gradient(135deg, #fff1f0, #fff)' : undefined
                        }}
                        title={
                          <Space>
                            <Badge count={idx + 1} style={{ backgroundColor: l.isSuspicious ? '#ff4d4f' : '#1677ff' }} />
                            <span className={`lesion-tag type-${l.type === '息肉' ? 'polyp' : l.type === '炎症' ? 'inflammation' : l.type === '溃疡' ? 'ulcer' : l.type === '肿瘤' ? 'tumor' : l.type === '血管畸形' ? 'vascular' : 'other'}`}>
                              {l.type}
                            </span>
                            {l.isSuspicious && <Tag color="red">疑似</Tag>}
                            {progress.percent === 100 && <Tag color="green">已完善</Tag>}
                          </Space>
                        }
                        extra={
                          <Tooltip title="完成度">
                            <Progress type="dashboard" percent={progress.percent} size={40} />
                          </Tooltip>
                        }
                      >
                        <Descriptions column={1} size="small" style={{ marginBottom: 10 }}>
                          <Descriptions.Item label="部位">{l.location}</Descriptions.Item>
                          <Descriptions.Item label="大小">{l.size}</Descriptions.Item>
                          <Descriptions.Item label="描述">{l.description}</Descriptions.Item>
                        </Descriptions>
                        <Divider style={{ margin: '8px 0' }} />
                        <Form layout="vertical" size="small">
                          <Form.Item label="分型 / 分级选择" required>
                            <Select
                              allowClear
                              showSearch
                              value={g.grade || undefined}
                              placeholder={`请选择${l.type}分级`}
                              options={gradeOptions[l.type].map(o => ({
                                value: o.value,
                                label: o.label,
                                title: o.desc
                              }))}
                              onChange={v => setLesionGrades({
                                ...lesionGrades,
                                [l.id]: { ...g, grade: v }
                              })}
                            />
                          </Form.Item>
                          <Form.Item label="大小（mm）" tooltip="内镜下估计长径">
                            <InputNumber
                              style={{ width: '100%' }}
                              min={0} max={200} step={0.5}
                              placeholder="输入病变大小"
                              onChange={v => setLesionGrades({
                                ...lesionGrades,
                                [l.id]: { ...g, size: v || 0 }
                              })}
                            />
                          </Form.Item>
                          <Form.Item label="是否建议活检" required>
                            <Radio.Group
                              value={g.biopsyRecommended?.needBiopsy}
                              onChange={e => setLesionGrades({
                                ...lesionGrades,
                                [l.id]: {
                                  ...g,
                                  biopsyRecommended: {
                                    needBiopsy: e.target.value,
                                    requiredPieces: ['肿瘤', '溃疡'].includes(l.type) ? 4 : 2,
                                    reason: ''
                                  }
                                }
                              })}
                            >
                              <Radio value={true}>需要</Radio>
                              <Radio value={false}>不需要</Radio>
                            </Radio.Group>
                          </Form.Item>
                          <div style={{ fontSize: 12, color: '#8c8c8c', lineHeight: 1.6 }}>
                            {g.grade && <div>✅ 分级说明：{gradeOptions[l.type].find(o => o.value === g.grade)?.desc}</div>}
                            {l.isSuspicious && (
                              <div style={{ color: '#ff4d4f' }}>⚠️ 该病灶为 AI 标注疑似，建议综合评估后补充必要的活检</div>
                            )}
                          </div>
                        </Form>
                      </Card>
                    </Col>
                  )
                })}
              </Row>
            )}
          </Card>
        </Col>
      </Row>
    </PageLayout>
  )
}

const EditOutlinedIcon: React.FC = () => <BulbOutlined />

function generateFollowUpSuggestion(case_: any, grades: Record<string, any>): string {
  const hasHighRisk = case_.lesions.some((l: any) => l.type === '肿瘤' || grades[l.id]?.grade === 'Ⅱc型')
  const hasPolyps = case_.lesions.some((l: any) => l.type === '息肉')
  const hasUlcer = case_.lesions.some((l: any) => l.type === '溃疡')
  if (hasHighRisk) return '建议 EUS 评估浸润深度，多学科会诊，考虑 ESD 或手术治疗'
  if (hasUlcer) return '规律 PPI 治疗 6-8 周后复查胃镜，确认溃疡愈合'
  if (hasPolyps) return '已切除息肉送病理，根据病理结果决定 6-12 个月后复查'
  return case_.status === '已通过' ? '建议 1-2 年后常规体检复查' : '完善评估后发布报告'
}

export default DiagnosisPage
