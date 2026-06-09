import React, { useEffect, useState } from 'react'
import {
  Row, Col, Card, Descriptions, Tag, Button, Space, Image, Timeline,
  List, Badge, Divider, Avatar, Tooltip, App, Modal, Progress
} from 'antd'
import {
  UserOutlined, ClockCircleOutlined, FileTextOutlined,
  PictureOutlined, BulbOutlined, AuditOutlined, TrophyOutlined,
  ScanOutlined, EyeOutlined, PlayCircleOutlined, ZoomInOutlined,
  ExclamationCircleOutlined, CheckCircleOutlined, StopOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import PageLayout, { openWindow, getQueryParams } from '../components/PageLayout'
import { useAppStore } from '../store/useAppStore'
import type { CaseStatus, LesionType, CaseRecord } from '../types'

const statusColors: Record<CaseStatus, string> = {
  '待复核': 'orange',
  '复核中': 'blue',
  '已通过': 'green',
  '已退回': 'red',
  '争议中': 'purple'
}

const lesionClass: Record<LesionType, string> = {
  '息肉': 'type-polyp',
  '炎症': 'type-inflammation',
  '溃疡': 'type-ulcer',
  '肿瘤': 'type-tumor',
  '血管畸形': 'type-vascular',
  '其他': 'type-other'
}

const CaseDetailPage: React.FC = () => {
  const { message } = App.useApp()
  const { cases, setCurrentCase, getCurrentCase, selectedKeyFrames, toggleKeyFrame, clearKeyFrames, currentCaseId } = useAppStore()
  const [previewKf, setPreviewKf] = useState<string | null>(null)
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>()

  useEffect(() => {
    const params = getQueryParams()
    const id = params.caseId || currentCaseId
    const caseList = cases
    const target = id
      ? caseList.find(c => c.id === id)
      : caseList.find(c => c.status === '待复核' || c.status === '复核中') || caseList[0]
    if (target) {
      setCurrentCase(target.id)
      setSelectedCaseId(target.id)
      clearKeyFrames()
    }
  }, [currentCaseId])

  const case_ = selectedCaseId ? cases.find(c => c.id === selectedCaseId) : undefined

  const openCaseQuickPick = () => {
    Modal.info({
      title: '快速切换病例',
      width: 720,
      content: (
        <List
          size="small"
          dataSource={cases.slice(0, 20)}
          renderItem={c => (
            <List.Item
              key={c.id}
              actions={[
                <Button size="small" type="primary" onClick={() => {
                  setCurrentCase(c.id)
                  setSelectedCaseId(c.id)
                  clearKeyFrames()
                  Modal.destroyAll()
                }}>选择</Button>
              ]}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                setCurrentCase(c.id)
                setSelectedCaseId(c.id)
                clearKeyFrames()
                Modal.destroyAll()
              }}
            >
              <List.Item.Meta
                avatar={<Avatar icon={<UserOutlined />} />}
                title={
                  <Space>
                    <b>{c.caseNo}</b>
                    <Tag color={statusColors[c.status]}>{c.status}</Tag>
                    <Tag color="blue">{c.examType}</Tag>
                  </Space>
                }
                description={`${c.patient.name} / ${c.patient.gender} / ${c.patient.age}岁 · ${c.doctor.name} · ${c.examDate} · ${c.diagnosis.slice(0, 40)}...`}
              />
            </List.Item>
          )}
        />
      ),
      okText: '关闭'
    })
  }

  const openSubWindow = async (name: string) => {
    if (case_) {
      await openWindow(name, { caseId: case_.id })
      message.success(`已打开相关窗口`)
    }
  }

  if (!case_) {
    return (
      <PageLayout title="病例详情" currentKey="case-detail">
        <div className="empty-hint">
          <h3>暂无可用病例</h3>
          <Button type="primary" onClick={() => openWindow('pending-list')}>返回待复核列表</Button>
        </div>
      </PageLayout>
    )
  }

  const suspiciousKfCount = case_.keyFrames.filter(kf => kf.lesionMarked).length
  const suspiciousLessionCount = case_.lesions.filter(l => l.isSuspicious).length

  return (
    <PageLayout
      title="病例详情"
      currentKey="case-detail"
      subtitle={`病例编号：${case_.caseNo} · ${case_.patient.name} · ${case_.examDate} · ${case_.status}`}
      extra={
        <Space>
          <Tooltip title="快速切换病例">
            <Button icon={<ScanOutlined />} onClick={openCaseQuickPick}>切换病例</Button>
          </Tooltip>
          <Tooltip title="图像对比">
            <Button icon={<PictureOutlined />} onClick={() => openSubWindow('image-compare')}>图像对比</Button>
          </Tooltip>
          <Tooltip title="诊断建议">
            <Button icon={<BulbOutlined />} onClick={() => openSubWindow('diagnosis')}>诊断建议</Button>
          </Tooltip>
          <Tooltip title="报告校对">
            <Button icon={<AuditOutlined />} onClick={() => openSubWindow('report-proof')}>报告校对</Button>
          </Tooltip>
          <Tooltip title="质控评分">
            <Button type="primary" icon={<TrophyOutlined />} onClick={() => openSubWindow('qc-score')}>质控评分</Button>
          </Tooltip>
        </Space>
      }
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16} xl={17}>
          <Card className="info-card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3><UserOutlined /> 基本信息</h3>
              <Space>
                <Tag color={statusColors[case_.status]} style={{ padding: '4px 12px', fontSize: 13 }}>
                  {case_.status}
                </Tag>
                <Tag color="blue" style={{ padding: '4px 12px', fontSize: 13 }}>{case_.examType}</Tag>
              </Space>
            </div>
            <Descriptions column={{ xs: 1, sm: 2, md: 3, lg: 3 }} size="small" bordered>
              <Descriptions.Item label="病例编号">{case_.caseNo}</Descriptions.Item>
              <Descriptions.Item label="检查日期">{case_.examDate}</Descriptions.Item>
              <Descriptions.Item label="病历号">{case_.patient.medicalRecordNo}</Descriptions.Item>
              <Descriptions.Item label="患者姓名">{case_.patient.name}</Descriptions.Item>
              <Descriptions.Item label="性别/年龄">
                {case_.patient.gender} / {case_.patient.age} 岁
              </Descriptions.Item>
              <Descriptions.Item label="联系电话">{case_.patient.phone}</Descriptions.Item>
              <Descriptions.Item label="身份证号">{case_.patient.idCard}</Descriptions.Item>
              <Descriptions.Item label="操作医生">
                {case_.doctor.name} <span style={{ color: '#8c8c8c' }}>({case_.doctor.title})</span>
              </Descriptions.Item>
              <Descriptions.Item label="助手">{case_.assistant}</Descriptions.Item>
              <Descriptions.Item label="开始时间">{case_.startTime}</Descriptions.Item>
              <Descriptions.Item label="结束时间">{case_.endTime}</Descriptions.Item>
              <Descriptions.Item label="检查时长">
                {dayjs(`${case_.examDate} ${case_.endTime}`).diff(dayjs(`${case_.examDate} ${case_.startTime}`), 'minute')} 分钟
              </Descriptions.Item>
              <Descriptions.Item label="检查指征" span={3}>{case_.indication}</Descriptions.Item>
              <Descriptions.Item label="复核人" span={case_.reviewer ? 1 : 2}>
                {case_.reviewer || '尚未复核'}
              </Descriptions.Item>
              {case_.reviewDate && (
                <Descriptions.Item label="复核日期" span={1}>
                  {case_.reviewDate}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          <Card className="info-card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3><PlayCircleOutlined /> 检查过程 · 关键帧（共 {case_.keyFrames.length} 帧）
                <Tag style={{ marginLeft: 8 }} color="red">异常标注 {suspiciousKfCount}</Tag>
                <Tag style={{ marginLeft: 4 }} color="blue">已选 {selectedKeyFrames.size}</Tag>
              </h3>
              <Space>
                <Button size="small" onClick={() => message.info('播放全部关键帧（模拟）')}>
                  <PlayCircleOutlined /> 浏览
                </Button>
                <Button size="small" onClick={clearKeyFrames}>
                  清除选择
                </Button>
              </Space>
            </div>
            <div className="kf-grid">
              {case_.keyFrames.map((kf, idx) => (
                <Tooltip key={kf.id} title={`${idx + 1}. ${kf.description}`}>
                  <div
                    className={`kf-item ${selectedKeyFrames.has(kf.id) ? 'selected' : ''}`}
                    onClick={() => toggleKeyFrame(kf.id)}
                    onDoubleClick={() => setPreviewKf(kf.imageUrl)}
                  >
                    <img src={kf.imageUrl} alt={kf.description} loading="lazy" />
                    {kf.lesionMarked && <span className="kf-badge">异常</span>}
                    <div className="kf-overlay">
                      <div className="kf-desc">{idx + 1}. {kf.description}</div>
                      <div className="kf-time"><ClockCircleOutlined /> {kf.timestamp}</div>
                    </div>
                  </div>
                </Tooltip>
              ))}
            </div>
          </Card>

          {case_.aiSuggestions && case_.aiSuggestions.length > 0 && (
            <Card className="info-card" style={{ marginBottom: 16, border: '1px solid #1677ff', background: 'linear-gradient(135deg, #e6f4ff, #fff)' }}>
              <div className="card-header">
                <h3 style={{ color: '#1677ff' }}><BulbOutlined /> AI 辅助建议</h3>
                <Tag color="blue">智能提示</Tag>
              </div>
              <List
                size="small"
                dataSource={case_.aiSuggestions}
                renderItem={(s, i) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Badge count={i + 1} color="#1677ff" />}
                      description={s}
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}

          <Card className="info-card">
            <div className="card-header">
              <h3><FileTextOutlined /> 检查过程记录</h3>
            </div>
            <div style={{ padding: '4px 0 8px' }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>操作过程：</div>
              <div style={{ lineHeight: 1.8, color: '#262626', padding: '10px 14px', background: '#f6ffed', borderRadius: 6 }}>
                {case_.procedure}
              </div>
            </div>
            <Divider style={{ margin: '16px 0' }} />
            <Timeline
              mode="left"
              items={[
                { label: case_.startTime, children: '进镜开始', color: 'blue' },
                ...case_.lesions.map((l, i) => ({
                  label: `00:${String((i + 1) * 5 + 3).padStart(2, '0')}:15`,
                  children: `发现${l.type}：${l.location}（${l.size}）${l.grade ? ' - ' + l.grade : ''}`,
                  color: l.isSuspicious ? 'red' : 'orange',
                  dot: l.isSuspicious ? <ExclamationCircleOutlined /> : <EyeOutlined />
                })),
                ...(case_.biopsy.length > 0 ? [{
                  label: `00:${String(case_.lesions.length * 5 + 10).padStart(2, '0')}:30`,
                  children: `取活检 ${case_.biopsy.length} 处，共 ${case_.biopsy.reduce((s, b) => s + b.pieces, 0)} 块`,
                  color: 'purple'
                }] : []),
                { label: case_.endTime, children: '退镜结束，患者安返', color: 'green' }
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8} xl={7}>
          <Card className="info-card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3><TrophyOutlined /> 质控总览</h3>
            </div>
            <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
              <Progress
                type="dashboard"
                percent={case_.qcTotalScore}
                size={140}
                strokeColor={case_.qcTotalScore >= 90 ? '#52c41a' : case_.qcTotalScore >= 80 ? '#1677ff' : case_.qcTotalScore >= 70 ? '#fa8c16' : '#ff4d4f'}
                format={p => (
                  <div style={{ lineHeight: 1.3 }}>
                    <div style={{ fontSize: 28, fontWeight: 700 }}>{case_.qcTotalScore}</div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>总分 / 100</div>
                  </div>
                )}
              />
            </div>
            <Space direction="vertical" style={{ width: '100%' }} size={[4, 4]}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>病灶数</span><b>{case_.lesions.length} 处</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>活检数</span><b>{case_.biopsy.length} 处 / {case_.biopsy.reduce((s, b) => s + b.pieces, 0)} 块</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>报告问题</span>
                <b style={{ color: case_.reportIssues.length > 0 ? '#ff4d4f' : '#52c41a' }}>{case_.reportIssues.length} 项</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>争议记录</span><b>{case_.disputes.length} 条</b>
              </div>
            </Space>
          </Card>

          <Card className="info-card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3><EyeOutlined /> 发现病灶 / 异常</h3>
              <span style={{ fontSize: 12, color: '#8c8c8c' }}>共 {case_.lesions.length} 处</span>
            </div>
            {case_.lesions.length === 0 ? (
              <div className="empty-hint" style={{ padding: '20px 0' }}>未发现明显异常</div>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={[8, 8]}>
                {case_.lesions.map((l, idx) => (
                  <Card
                    key={l.id}
                    size="small"
                    style={{
                      borderRadius: 6,
                      border: l.isSuspicious ? '1px solid #ff4d4f' : '1px solid #f0f0f0'
                    }}
                    title={
                      <Space>
                        <Badge count={idx + 1} style={{ backgroundColor: l.isSuspicious ? '#ff4d4f' : '#1677ff' }} />
                        <span className={`lesion-tag ${lesionClass[l.type]}`}>{l.type}</span>
                        {l.grade && <Tag color="purple">{l.grade}</Tag>}
                        {l.isSuspicious && <Tag color="red">疑似</Tag>}
                      </Space>
                    }
                    extra={l.imageIndex !== undefined && case_.keyFrames[l.imageIndex] && (
                      <Tooltip title="查看关键帧">
                        <Button
                          type="link"
                          size="small"
                          icon={<ZoomInOutlined />}
                          onClick={() => setPreviewKf(case_.keyFrames[l.imageIndex!].imageUrl)}
                        />
                      </Tooltip>
                    )}
                  >
                    <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                      <div><b>部位：</b>{l.location}</div>
                      <div><b>大小：</b>{l.size}</div>
                      <div><b>描述：</b>{l.description}</div>
                    </div>
                  </Card>
                ))}
              </Space>
            )}
          </Card>

          {case_.historyExams.length > 0 && (
            <Card className="info-card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <h3><ClockCircleOutlined /> 历史检查记录</h3>
                <span style={{ fontSize: 12, color: '#8c8c8c' }}>共 {case_.historyExams.length} 次</span>
              </div>
              <Timeline
                mode="left"
                items={case_.historyExams.map(h => ({
                  label: h.date,
                  color: 'blue',
                  children: (
                    <div>
                      <div style={{ fontWeight: 500 }}>{h.type}</div>
                      <div style={{ fontSize: 12, color: '#595959', marginTop: 2 }}>{h.diagnosis}</div>
                      <Image.PreviewGroup items={h.imageUrls}>
                        <Image
                          width={60}
                          height={40}
                          src={h.imageUrls[0]}
                          style={{ marginTop: 6, objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }}
                        />
                        {h.imageUrls.slice(1).map((u, i) => (
                          <Image key={i} width={60} height={40} src={u} style={{ display: 'none' }} />
                        ))}
                      </Image.PreviewGroup>
                    </div>
                  )
                }))}
              />
            </Card>
          )}

          {case_.reportIssues.length > 0 && (
            <Card className="info-card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <h3><ExclamationCircleOutlined /> 报告存在问题</h3>
                <Tag color={case_.reportIssues.some(i => i.severity === '高') ? 'red' : 'orange'}>
                  {case_.reportIssues.some(i => i.severity === '高') ? '需关注' : '待处理'}
                </Tag>
              </div>
              <Space direction="vertical" style={{ width: '100%' }} size={[6, 6]}>
                {case_.reportIssues.map(i => (
                  <div key={i.id} className={`issue-card severity-${i.severity === '高' ? 'high' : i.severity === '中' ? 'medium' : 'low'}`}>
                    <div className="issue-header">
                      <span className="issue-type">
                        <Tag color={i.severity === '高' ? 'red' : i.severity === '中' ? 'orange' : 'default'}>{i.severity}</Tag>
                        {i.type}
                      </span>
                      <span className="issue-field">【{i.field}】</span>
                    </div>
                    <div className="issue-desc">{i.description}</div>
                    <div className="issue-suggestion">💡 {i.suggestion}</div>
                  </div>
                ))}
              </Space>
            </Card>
          )}

          {case_.reviewComment && (
            <Card className="info-card">
              <div className="card-header">
                <h3><CheckCircleOutlined /> 复核意见</h3>
                <Tag color={case_.status === '已通过' ? 'green' : case_.status === '已退回' ? 'red' : 'purple'}>
                  {case_.status === '已通过' ? '通过' : case_.status === '已退回' ? '退回' : '争议中'}
                </Tag>
              </div>
              <div style={{ background: '#fafafa', padding: 12, borderRadius: 6, fontSize: 13, lineHeight: 1.7 }}>
                {case_.reviewComment}
              </div>
              {case_.disputes.length > 0 && (
                <>
                  <Divider />
                  <h4 style={{ margin: 0, marginBottom: 10 }}>争议记录</h4>
                  <Timeline
                    items={case_.disputes.map(d => ({
                      color: d.status === '已解决' ? 'green' : d.status === '待处理' ? 'red' : 'orange',
                      children: (
                        <div>
                          <div style={{ fontWeight: 500 }}>
                            {d.reviewer} · <Tag>{d.status}</Tag>
                          </div>
                          <div style={{ fontSize: 12, color: '#595959' }}>{d.reason}</div>
                          {d.resolution && (
                            <div style={{ fontSize: 12, color: '#52c41a', marginTop: 4 }}>
                              ✅ {d.resolution}
                            </div>
                          )}
                        </div>
                      )
                    }))}
                  />
                </>
              )}
            </Card>
          )}
        </Col>
      </Row>

      {previewKf && (
        <Image
          style={{ display: 'none' }}
          preview={{
            visible: !!previewKf,
            src: previewKf,
            onVisibleChange: v => !v && setPreviewKf(null)
          }}
          src={previewKf}
        />
      )}
    </PageLayout>
  )
}

export default CaseDetailPage
