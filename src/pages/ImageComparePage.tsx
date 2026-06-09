import React, { useEffect, useRef, useState } from 'react'
import {
  Row, Col, Card, Select, Space, Button, List, Tag, Tooltip, Modal,
  Slider, Input, InputNumber, Radio, Divider, App, Drawer, Badge, Form, message as antMessage
} from 'antd'
import {
  PictureOutlined, PlusOutlined, DeleteOutlined, EditOutlined,
  BulbOutlined, LeftOutlined, RightOutlined, SearchOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, CloseCircleOutlined
} from '@ant-design/icons'
import PageLayout, { getQueryParams, openWindow } from '../components/PageLayout'
import { useAppStore } from '../store/useAppStore'
import type { LesionType, CaseRecord, HistoryExam } from '../types'

const lesionTypeColors: Record<LesionType, string> = {
  '息肉': '#1677ff',
  '炎症': '#fa8c16',
  '溃疡': '#ff4d4f',
  '肿瘤': '#722ed1',
  '血管畸形': '#13c2c2',
  '其他': '#8c8c8c'
}

type Marker = {
  id: string
  x: number
  y: number
  r: number
  type: LesionType
  label: string
  note?: string
  confirmed?: boolean
}

const ImageComparePage: React.FC = () => {
  const { message, modal } = App.useApp()
  const { cases, markedAnnotations, addAnnotation, removeAnnotation, getCurrentCase, setCurrentCase } = useAppStore()
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>()
  const [leftHistoryId, setLeftHistoryId] = useState<string | 'current'>('current')
  const [rightHistoryId, setRightHistoryId] = useState<string | 'current'>('current')
  const [leftImgIdx, setLeftImgIdx] = useState(0)
  const [rightImgIdx, setRightImgIdx] = useState(0)
  const [zoomLeft, setZoomLeft] = useState(100)
  const [zoomRight, setZoomRight] = useState(100)
  const [markerDrawerOpen, setMarkerDrawerOpen] = useState(false)
  const [markerSide, setMarkerSide] = useState<'left' | 'right'>('left')
  const [form] = Form.useForm<{ type: LesionType; label: string; note: string }>()

  const leftImgRef = useRef<HTMLDivElement>(null)
  const rightImgRef = useRef<HTMLDivElement>(null)
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const params = getQueryParams()
    const id = params.caseId
    const caseList = cases
    const target = id
      ? caseList.find(c => c.id === id)
      : caseList.find(c => c.keyFrames.length > 0) || caseList[0]
    if (target) {
      setCurrentCase(target.id)
      setSelectedCaseId(target.id)
    }
  }, [])

  const case_ = selectedCaseId ? cases.find(c => c.id === selectedCaseId) : undefined

  const getSideItems = (caseItem: CaseRecord, historyId: string | 'current') => {
    if (historyId === 'current') {
      return caseItem.keyFrames.map(kf => ({ id: kf.id, image: kf.imageUrl, label: kf.description, time: kf.timestamp, marked: kf.lesionMarked }))
    }
    const h = caseItem.historyExams.find(x => x.id === historyId)
    if (!h) return []
    return h.imageUrls.map((img, i) => ({ id: `${h.id}-${i}`, image: img, label: `${h.type} #${i + 1}`, time: h.date, marked: false }))
  }

  if (!case_) {
    return (
      <PageLayout title="图像对比" currentKey="image-compare">
        <div className="empty-hint">
          <h3>请先选择病例</h3>
          <Button type="primary" onClick={() => openWindow('pending-list')}>返回列表</Button>
        </div>
      </PageLayout>
    )
  }

  const leftItems = getSideItems(case_, leftHistoryId)
  const rightItems = getSideItems(case_, rightHistoryId)
  const leftImg = leftItems[leftImgIdx]
  const rightImg = rightItems[rightImgIdx]

  const handleImageClick = (side: 'left' | 'right', e: React.MouseEvent<HTMLDivElement>) => {
    const target = (side === 'left' ? leftImgRef : rightImgRef).current
    if (!target) return
    const rect = target.getBoundingClientRect()
    const img = target.querySelector('img')
    if (!img) return
    const imgRect = img.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, ((e.clientX - imgRect.left) / imgRect.width) * 100))
    const y = Math.max(0, Math.min(1, ((e.clientY - imgRect.top) / imgRect.height) * 100))
    setPendingPos({ x, y })
    setMarkerSide(side)
    form.resetFields()
    form.setFieldsValue({ type: '息肉', label: '新标注' })
    setMarkerDrawerOpen(true)
  }

  const confirmMarker = () => {
    if (!pendingPos) return
    const values = form.getFieldsValue()
    const side = markerSide
    const frameId = side === 'left'
      ? (leftImg?.id || '')
      : (rightImg?.id || '')
    if (!frameId) return
    addAnnotation(frameId, {
      x: pendingPos.x,
      y: pendingPos.y,
      r: 8,
      type: values.type,
      label: values.label
    })
    message.success(`已在${side === 'left' ? '左' : '右'}图添加${values.type}标注`)
    setMarkerDrawerOpen(false)
    setPendingPos(null)
  }

  const historyOpts = [
    { value: 'current', label: `本次 ${case_.examType}（${case_.examDate}） - ${case_.keyFrames.length} 帧` }
  ]
  case_.historyExams.forEach(h => {
    historyOpts.push({ value: h.id, label: `历史 ${h.type}（${h.date}） - ${h.imageUrls.length} 帧 · ${h.diagnosis.slice(0, 18)}` })
  })

  const lesionSummary = [
    ...case_.lesions.map(l => ({ ...l, source: '本次检查标注' as const, color: lesionTypeColors[l.type] })),
    ...Object.entries(markedAnnotations)
      .filter(([id]) => case_.keyFrames.some(kf => kf.id === id))
      .flatMap(([id, anns]) => anns.map((a, idx) => ({
        id: `ann-${id}-${idx}`,
        type: a.type as LesionType,
        location: '标注于 ' + (case_.keyFrames.find(kf => kf.id === id)?.description || id),
        size: '-',
        description: a.label,
        grade: undefined,
        isSuspicious: false,
        source: '手动标注' as const,
        color: lesionTypeColors[a.type as LesionType]
      })))
  ]

  const suspiciousItems = lesionSummary.filter((l: any) => l.isSuspicious || l.type === '溃疡' || l.type === '肿瘤')

  const switchSide = () => {
    setLeftHistoryId(rightHistoryId)
    setRightHistoryId(leftHistoryId)
    const t = leftImgIdx
    setLeftImgIdx(rightImgIdx)
    setRightImgIdx(t)
  }

  return (
    <PageLayout
      title="图像对比"
      currentKey="image-compare"
      subtitle={`病例 ${case_.caseNo} - ${case_.patient.name} · 并排对比历史影像，辅助病灶识别与标注`}
      extra={
        <Space>
          <Button onClick={switchSide} icon={<SwapIcon />}>左右互换</Button>
          <Tooltip title="并排对比模式">
            <Radio.Group defaultValue="side" size="small">
              <Radio.Button value="side">并排对比</Radio.Button>
              <Radio.Button value="overlay">叠加对比</Radio.Button>
              <Radio.Button value="quad">四格对照</Radio.Button>
            </Radio.Group>
          </Tooltip>
        </Space>
      }
    >
      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <div className="compare-panel" style={{ minHeight: 560 }}>
            <div className="compare-side">
              <div className="side-header">
                <Space direction="vertical" size={0}>
                  <Select
                    size="small"
                    style={{ width: 360 }}
                    value={leftHistoryId}
                    onChange={v => { setLeftHistoryId(v); setLeftImgIdx(0) }}
                    options={historyOpts}
                  />
                  <h4 style={{ margin: '4px 0 0', color: '#1677ff' }}>
                    {leftImg?.label}
                    <Tag style={{ marginLeft: 6 }} color="blue">
                      {leftImgIdx + 1} / {leftItems.length}
                    </Tag>
                  </h4>
                </Space>
                <Space>
                  <Button size="small" icon={<LeftOutlined />} disabled={leftImgIdx === 0}
                    onClick={() => setLeftImgIdx(i => i - 1)} />
                  <Button size="small" icon={<RightOutlined />} disabled={leftImgIdx >= leftItems.length - 1}
                    onClick={() => setLeftImgIdx(i => i + 1)} />
                  <Button size="small" icon={<PlusOutlined />} onClick={() => handleImageClick('left', {
                    clientX: 0, clientY: 0,
                    currentTarget: leftImgRef.current!
                  } as any)}>中心标注</Button>
                </Space>
              </div>
              <div
                ref={leftImgRef}
                className="side-content"
                onClick={(e) => handleImageClick('left', e)}
                style={{ cursor: 'crosshair' }}
              >
                {leftImg && (
                  <img
                    src={leftImg.image}
                    alt="left"
                    style={{ transform: `scale(${zoomLeft / 100})`, transition: 'transform 0.2s' }}
                    draggable={false}
                  />
                )}
                {(markedAnnotations[leftImg?.id || ''] || []).map((m, idx) => (
                  <div
                    key={idx}
                    className="canvas-marker"
                    style={{
                      left: `${m.x}%`,
                      top: `${m.y}%`,
                      width: `${m.r * 2}%`,
                      height: `${m.r * 2}%`,
                      borderColor: lesionTypeColors[m.type as LesionType],
                      background: `${lesionTypeColors[m.type as LesionType]}22`
                    }}
                    title={`${m.type}: ${m.label}`}
                  >
                    <span style={{ background: lesionTypeColors[m.type as LesionType], padding: '1px 4px', borderRadius: 3, whiteSpace: 'nowrap' }}>
                      {idx + 1}
                    </span>
                  </div>
                ))}
                {leftImg?.marked && (
                  <Badge.Ribbon text="AI 检测异常" color="red" style={{ position: 'absolute', top: 8, right: 8 }} />
                )}
              </div>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, color: '#8c8c8c' }}>缩放：</span>
                <Slider min={50} max={200} value={zoomLeft} onChange={setZoomLeft} style={{ flex: 1 }} />
                <InputNumber size="small" min={50} max={200} value={zoomLeft} onChange={v => setZoomLeft(v || 100)} addonAfter="%" />
              </div>
              <div style={{ maxHeight: 130, overflow: 'auto', marginTop: 8, padding: 8, background: '#fafafa', borderRadius: 6 }}>
                <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>
                  {leftItems.length} 张图片（点击切换）
                </div>
                <div className="kf-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))' }}>
                  {leftItems.map((it, i) => (
                    <Tooltip key={it.id} title={it.label}>
                      <div
                        className={`kf-item ${i === leftImgIdx ? 'selected' : ''}`}
                        style={{ aspectRatio: 'auto', height: 54 }}
                        onClick={() => setLeftImgIdx(i)}
                      >
                        <img src={it.image} alt="" />
                        {it.marked && <span className="kf-badge">!</span>}
                      </div>
                    </Tooltip>
                  ))}
                </div>
              </div>
            </div>

            <div className="compare-side">
              <div className="side-header">
                <Space direction="vertical" size={0}>
                  <Select
                    size="small"
                    style={{ width: 360 }}
                    value={rightHistoryId}
                    onChange={v => { setRightHistoryId(v); setRightImgIdx(0) }}
                    options={historyOpts}
                  />
                  <h4 style={{ margin: '4px 0 0', color: '#722ed1' }}>
                    {rightImg?.label}
                    <Tag style={{ marginLeft: 6 }} color="purple">
                      {rightImgIdx + 1} / {rightItems.length}
                    </Tag>
                  </h4>
                </Space>
                <Space>
                  <Button size="small" icon={<LeftOutlined />} disabled={rightImgIdx === 0}
                    onClick={() => setRightImgIdx(i => i - 1)} />
                  <Button size="small" icon={<RightOutlined />} disabled={rightImgIdx >= rightItems.length - 1}
                    onClick={() => setRightImgIdx(i => i + 1)} />
                  <Button size="small" icon={<PlusOutlined />} onClick={() => handleImageClick('right', {
                    clientX: 0, clientY: 0,
                    currentTarget: rightImgRef.current!
                  } as any)}>中心标注</Button>
                </Space>
              </div>
              <div
                ref={rightImgRef}
                className="side-content"
                onClick={(e) => handleImageClick('right', e)}
                style={{ cursor: 'crosshair', background: '#1a0a1a' }}
              >
                {rightImg && (
                  <img
                    src={rightImg.image}
                    alt="right"
                    style={{ transform: `scale(${zoomRight / 100})`, transition: 'transform 0.2s', filter: 'none' }}
                    draggable={false}
                  />
                )}
                {(markedAnnotations[rightImg?.id || ''] || []).map((m, idx) => (
                  <div
                    key={idx}
                    className="canvas-marker"
                    style={{
                      left: `${m.x}%`,
                      top: `${m.y}%`,
                      width: `${m.r * 2}%`,
                      height: `${m.r * 2}%`,
                      borderColor: lesionTypeColors[m.type as LesionType],
                      background: `${lesionTypeColors[m.type as LesionType]}22`
                    }}
                    title={`${m.type}: ${m.label}`}
                  >
                    <span style={{ background: lesionTypeColors[m.type as LesionType], padding: '1px 4px', borderRadius: 3, whiteSpace: 'nowrap' }}>
                      {idx + 1}
                    </span>
                  </div>
                ))}
                {rightImg?.marked && (
                  <Badge.Ribbon text="AI 检测异常" color="red" style={{ position: 'absolute', top: 8, right: 8 }} />
                )}
              </div>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, color: '#8c8c8c' }}>缩放：</span>
                <Slider min={50} max={200} value={zoomRight} onChange={setZoomRight} style={{ flex: 1 }} />
                <InputNumber size="small" min={50} max={200} value={zoomRight} onChange={v => setZoomRight(v || 100)} addonAfter="%" />
              </div>
              <div style={{ maxHeight: 130, overflow: 'auto', marginTop: 8, padding: 8, background: '#fafafa', borderRadius: 6 }}>
                <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>
                  {rightItems.length} 张图片（点击切换）
                </div>
                <div className="kf-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))' }}>
                  {rightItems.map((it, i) => (
                    <Tooltip key={it.id} title={it.label}>
                      <div
                        className={`kf-item ${i === rightImgIdx ? 'selected' : ''}`}
                        style={{ aspectRatio: 'auto', height: 54 }}
                        onClick={() => setRightImgIdx(i)}
                      >
                        <img src={it.image} alt="" />
                        {it.marked && <span className="kf-badge">!</span>}
                      </div>
                    </Tooltip>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Col>

        <Col xs={24} lg={14}>
          <Card className="info-card">
            <div className="card-header">
              <h3><BulbOutlined /> 病灶汇总 / 标注列表
                <Tag color="red" style={{ marginLeft: 8 }}>疑似 {suspiciousItems.length}</Tag>
                <Tag color="blue" style={{ marginLeft: 4 }}>共 {lesionSummary.length}</Tag>
              </h3>
              <Space>
                <Input.Search
                  placeholder="搜索病灶描述..."
                  prefix={<SearchOutlined />}
                  size="small"
                  style={{ width: 220 }}
                />
                <Button size="small" icon={<PlusOutlined />} type="primary" onClick={() => {
                  setMarkerSide('left')
                  form.resetFields()
                  form.setFieldsValue({ type: '息肉', label: '新病灶' })
                  setPendingPos({ x: 50, y: 50 })
                  setMarkerDrawerOpen(true)
                }}>新增病灶</Button>
              </Space>
            </div>
            <List
              size="small"
              dataSource={lesionSummary as any[]}
              renderItem={(item: any, i) => (
                <List.Item
                  key={item.id}
                  actions={[
                    <Tooltip key="loc" title="定位到图">
                      <Button size="small" type="link" icon={<PictureOutlined />} />
                    </Tooltip>,
                    'source' in item && item.source === '手动标注' ? (
                      <Tooltip key="del" title="删除标注">
                        <Button size="small" type="link" danger icon={<DeleteOutlined />}
                          onClick={() => {
                            modal.confirm({
                              title: '删除标注',
                              content: '确定要删除此标注吗？',
                              onOk: () => message.success('已删除')
                            })
                          }} />
                      </Tooltip>
                    ) : null
                  ]}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 6,
                    marginBottom: 6,
                    background: item.isSuspicious ? '#fff1f0' : '#fff',
                    border: item.isSuspicious ? '1px solid #ffa39e' : '1px solid #f0f0f0'
                  }}
                >
                  <List.Item.Meta
                    avatar={
                      <Badge
                        count={i + 1}
                        style={{ backgroundColor: item.color || lesionTypeColors[item.type as LesionType] }}
                      />
                    }
                    title={
                      <Space>
                        <span className={`lesion-tag type-${item.type === '息肉' ? 'polyp' : item.type === '炎症' ? 'inflammation' : item.type === '溃疡' ? 'ulcer' : item.type === '肿瘤' ? 'tumor' : item.type === '血管畸形' ? 'vascular' : 'other'}`}>
                          {item.type}
                        </span>
                        {item.grade && <Tag color="purple">{item.grade}</Tag>}
                        {item.isSuspicious && <Tag color="red" icon={<ExclamationCircleOutlined />}>疑似</Tag>}
                        {'source' in item && <Tag color={item.source === '手动标注' ? 'blue' : 'geekblue'}>{item.source}</Tag>}
                      </Space>
                    }
                    description={
                      <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                        <div><b>部位：</b>{item.location} &nbsp; <b>大小：</b>{item.size}</div>
                        <div><b>描述：</b>{item.description}</div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card className="info-card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3>标注类型图例</h3>
            </div>
            <Space direction="vertical" size={[8, 8]} style={{ width: '100%' }}>
              {(Object.entries(lesionTypeColors) as [LesionType, string][]).map(([t, c]) => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 18, height: 18, border: `2px dashed ${c}`, borderRadius: '50%', background: `${c}22` }} />
                  <span className={`lesion-tag type-${t === '息肉' ? 'polyp' : t === '炎症' ? 'inflammation' : t === '溃疡' ? 'ulcer' : t === '肿瘤' ? 'tumor' : t === '血管畸形' ? 'vascular' : 'other'}`}>
                    {t}
                  </span>
                  <span style={{ fontSize: 12, color: '#8c8c8c' }}>
                    {t === '息肉' && '黏膜隆起性病变，关注分型与基底'}
                    {t === '炎症' && '黏膜充血水肿，关注程度分级'}
                    {t === '溃疡' && '黏膜凹陷性缺损，关注分期'}
                    {t === '肿瘤' && '形态不规则，高度警惕恶性'}
                    {t === '血管畸形' && '血管异常，警惕出血风险'}
                    {t === '其他' && '其他异常发现'}
                  </span>
                </div>
              ))}
            </Space>
            <Divider />
            <div style={{ fontSize: 13, lineHeight: 1.8, color: '#595959' }}>
              <div><b>操作提示：</b></div>
              <div>• 点击图像任意位置可添加新标注</div>
              <div>• 可在左右窗口选择不同时间点的影像进行对比</div>
              <div>• 拖动缩放滑块可放大观察细节</div>
              <div>• 红色丝带标记为 AI 检测出的疑似异常区域</div>
            </div>
          </Card>

          <Card className="info-card">
            <div className="card-header">
              <h3>历史对比说明</h3>
            </div>
            <List
              size="small"
              dataSource={[
                { icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />, title: '病灶稳定', desc: '大小、形态无明显变化，继续随访' },
                { icon: <ExclamationCircleOutlined style={{ color: '#fa8c16' }} />, title: '病灶进展', desc: '增大、形态改变或分级升高，建议积极处理' },
                { icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />, title: '新发病灶', desc: '本次新发现的病变，建议重点关注' },
                { icon: <CheckCircleOutlined style={{ color: '#1677ff' }} />, title: '病灶好转', desc: '缩小或瘢痕化，治疗效果良好' }
              ]}
              renderItem={it => (
                <List.Item>
                  <List.Item.Meta avatar={it.icon} title={<b>{it.title}</b>} description={it.desc} />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Drawer
        title={`新增标注（${markerSide === 'left' ? '左' : '右'}侧图像）`}
        open={markerDrawerOpen}
        onClose={() => setMarkerDrawerOpen(false)}
        width={380}
        extra={
          <Space>
            <Button onClick={() => setMarkerDrawerOpen(false)}>取消</Button>
            <Button type="primary" onClick={confirmMarker} icon={<CheckCircleOutlined />}>确定添加</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item label="病灶类型" name="type" rules={[{ required: true, message: '请选择类型' }]}>
            <Radio.Group>
              {(Object.keys(lesionTypeColors) as LesionType[]).map(t => (
                <Radio.Button key={t} value={t}>
                  <span style={{ color: lesionTypeColors[t] }}>●</span> {t}
                </Radio.Button>
              ))}
            </Radio.Group>
          </Form.Item>
          <Form.Item label="标注标签" name="label" rules={[{ required: true, message: '请输入标签' }]}>
            <Input placeholder="如：胃窦后壁息肉" />
          </Form.Item>
          <Form.Item label="备注说明" name="note">
            <Input.TextArea rows={4} placeholder="可补充大小、形态、NBI/染色特征等..." />
          </Form.Item>
          <Divider />
          <div style={{ fontSize: 12, color: '#8c8c8c', lineHeight: 1.7 }}>
            {pendingPos && (
              <div>
                标注位置：X ≈ {pendingPos.x.toFixed(1)}%, Y ≈ {pendingPos.y.toFixed(1)}%
              </div>
            )}
            标注后可在病灶汇总中查看。
          </div>
        </Form>
      </Drawer>
    </PageLayout>
  )
}

const SwapIcon: React.FC = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
    <LeftOutlined /><RightOutlined />
  </span>
)

export default ImageComparePage
