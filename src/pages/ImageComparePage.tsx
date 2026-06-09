import React, { useEffect, useRef, useState } from 'react'
import {
  Row, Col, Card, Select, Space, Button, List, Tag, Tooltip, Modal,
  Slider, Input, InputNumber, Radio, Divider, App, Drawer, Badge, Form
} from 'antd'
import {
  PictureOutlined, PlusOutlined, DeleteOutlined,
  BulbOutlined, LeftOutlined, RightOutlined, SearchOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, CloseCircleOutlined
} from '@ant-design/icons'
import PageLayout, { getQueryParams, openWindow } from '../components/PageLayout'
import { useAppStore } from '../store/useAppStore'
import type { LesionType, CaseRecord, ImageAnnotation } from '../types'

const lesionTypeColors: Record<LesionType, string> = {
  '息肉': '#1677ff',
  '炎症': '#fa8c16',
  '溃疡': '#ff4d4f',
  '肿瘤': '#722ed1',
  '血管畸形': '#13c2c2',
  '其他': '#8c8c8c'
}

const ImageComparePage: React.FC = () => {
  const { message, modal } = App.useApp()
  const { cases, addAnnotation, removeAnnotation, setCurrentCase, currentCaseId } = useAppStore()
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>()
  const [leftHistoryId, setLeftHistoryId] = useState<string | 'current'>('current')
  const [rightHistoryId, setRightHistoryId] = useState<string | 'current'>('current')
  const [leftImgIdx, setLeftImgIdx] = useState(0)
  const [rightImgIdx, setRightImgIdx] = useState(0)
  const [zoomLeft, setZoomLeft] = useState(100)
  const [zoomRight, setZoomRight] = useState(100)
  const [markerDrawerOpen, setMarkerDrawerOpen] = useState(false)
  const [markerSide, setMarkerSide] = useState<'left' | 'right'>('left')
  const [searchText, setSearchText] = useState('')
  const [form] = Form.useForm<{ type: LesionType; label: string; note: string }>()

  const leftImgRef = useRef<HTMLDivElement>(null)
  const rightImgRef = useRef<HTMLDivElement>(null)
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const params = getQueryParams()
    const id = params.caseId || currentCaseId
    const caseList = cases
    const target = id
      ? caseList.find(c => c.id === id)
      : caseList.find(c => c.keyFrames.length > 0) || caseList[0]
    if (target) {
      setCurrentCase(target.id, false)
      setSelectedCaseId(target.id)
    }
  }, [cases.length, currentCaseId])

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

  const getFrameAnnotations = (frameId?: string) =>
    case_?.imageAnnotations.filter(a => a.frameId === frameId) || []

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
    if (!pendingPos || !case_) return
    const values = form.getFieldsValue()
    const side = markerSide
    const frameId = side === 'left'
      ? (leftImg?.id || '')
      : (rightImg?.id || '')
    if (!frameId) return
    addAnnotation(case_.id, {
      frameId,
      x: pendingPos.x,
      y: pendingPos.y,
      r: 8,
      type: values.type,
      label: values.label,
      note: values.note
    })
    message.success(`已在${side === 'left' ? '左' : '右'}图添加${values.type}标注并保存`)
    setMarkerDrawerOpen(false)
    setPendingPos(null)
  }

  const historyOpts: { value: string; label: string }[] = [
    { value: 'current', label: `本次 ${case_.examType}（${case_.examDate}） - ${case_.keyFrames.length} 帧` }
  ]
  case_.historyExams.forEach(h => {
    historyOpts.push({ value: h.id, label: `历史 ${h.type}（${h.date}） - ${h.imageUrls.length} 帧 · ${h.diagnosis.slice(0, 18)}` })
  })

  type LesionSummaryItem = {
    id: string
    type: LesionType
    location: string
    size: string
    description: string
    grade?: string
    isSuspicious: boolean
    source: '系统' | '手动标注'
    color: string
    frameId?: string
    annotation?: ImageAnnotation
  }

  const manualAnnotations = case_.imageAnnotations
    .map(ann => {
      const kf = case_.keyFrames.find(k => k.id === ann.frameId)
      return {
        id: ann.id,
        type: ann.type as LesionType,
        location: '标注于 ' + (kf?.description || ann.frameId),
        size: ann.note ? `备注: ${ann.note.slice(0, 30)}` : '-',
        description: ann.label,
        grade: undefined,
        isSuspicious: ann.type === '溃疡' || ann.type === '肿瘤',
        source: '手动标注' as const,
        color: lesionTypeColors[ann.type as LesionType],
        frameId: ann.frameId,
        annotation: ann
      } as LesionSummaryItem
    })

  const systemLesions = case_.lesions.map(l => ({
    ...l,
    source: '系统' as const,
    color: lesionTypeColors[l.type],
    isSuspicious: l.isSuspicious || l.type === '溃疡' || l.type === '肿瘤',
    description: l.description,
    size: l.size,
    location: l.location,
    grade: l.grade
  } as LesionSummaryItem))

  const lesionSummary = [...systemLesions, ...manualAnnotations].filter(
    l => !searchText || l.description.includes(searchText) || l.location.includes(searchText)
  )
  const suspiciousItems = lesionSummary.filter(l => l.isSuspicious)

  const switchSide = () => {
    setLeftHistoryId(rightHistoryId)
    setRightHistoryId(leftHistoryId)
    const t = leftImgIdx
    setLeftImgIdx(rightImgIdx)
    setRightImgIdx(t)
  }

  const renderMarkers = (imgId?: string) => {
    const anns = getFrameAnnotations(imgId)
    return anns.map((m, idx) => (
      <div
        key={m.id}
        className="canvas-marker"
        style={{
          left: `${m.x}%`,
          top: `${m.y}%`,
          width: `${m.r * 2}%`,
          height: `${m.r * 2}%`,
          borderColor: lesionTypeColors[m.type as LesionType],
          background: `${lesionTypeColors[m.type as LesionType]}22`
        }}
        title={`${m.type}: ${m.label}${m.note ? ' - ' + m.note : ''}（点击下方列表可删除）`}
      >
        <span style={{
          background: lesionTypeColors[m.type as LesionType],
          color: '#fff',
          padding: '1px 5px',
          borderRadius: 3,
          whiteSpace: 'nowrap',
          fontSize: 11,
          fontWeight: 600
        }}>
          {idx + 1}
        </span>
      </div>
    ))
  }

  return (
    <PageLayout
      title="图像对比"
      currentKey="image-compare"
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
                    {getFrameAnnotations(leftImg?.id).length > 0 && (
                      <Tag color="red">标注 {getFrameAnnotations(leftImg?.id).length}</Tag>
                    )}
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
                {renderMarkers(leftImg?.id)}
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
                    <Tooltip key={it.id} title={it.label + (getFrameAnnotations(it.id).length ? `（${getFrameAnnotations(it.id).length}处标注）` : '')}>
                      <div
                        className={`kf-item ${i === leftImgIdx ? 'selected' : ''}`}
                        style={{ aspectRatio: 'auto', height: 54, position: 'relative' }}
                        onClick={() => setLeftImgIdx(i)}
                      >
                        <img src={it.image} alt="" />
                        {it.marked && <span className="kf-badge">!</span>}
                        {getFrameAnnotations(it.id).length > 0 && (
                          <span style={{
                            position: 'absolute',
                            bottom: 2,
                            right: 2,
                            background: '#ff4d4f',
                            color: '#fff',
                            borderRadius: 3,
                            fontSize: 10,
                            padding: '0 4px'
                          }}>{getFrameAnnotations(it.id).length}</span>
                        )}
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
                    {getFrameAnnotations(rightImg?.id).length > 0 && (
                      <Tag color="red">标注 {getFrameAnnotations(rightImg?.id).length}</Tag>
                    )}
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
                {renderMarkers(rightImg?.id)}
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
                    <Tooltip key={it.id} title={it.label + (getFrameAnnotations(it.id).length ? `（${getFrameAnnotations(it.id).length}处标注）` : '')}>
                      <div
                        className={`kf-item ${i === rightImgIdx ? 'selected' : ''}`}
                        style={{ aspectRatio: 'auto', height: 54, position: 'relative' }}
                        onClick={() => setRightImgIdx(i)}
                      >
                        <img src={it.image} alt="" />
                        {it.marked && <span className="kf-badge">!</span>}
                        {getFrameAnnotations(it.id).length > 0 && (
                          <span style={{
                            position: 'absolute',
                            bottom: 2,
                            right: 2,
                            background: '#722ed1',
                            color: '#fff',
                            borderRadius: 3,
                            fontSize: 10,
                            padding: '0 4px'
                          }}>{getFrameAnnotations(it.id).length}</span>
                        )}
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
                {manualAnnotations.length > 0 && (
                  <Tag color="cyan" style={{ marginLeft: 4 }}>手动 {manualAnnotations.length}</Tag>
                )}
              </h3>
              <Space>
                <Input
                  placeholder="搜索病灶描述..."
                  prefix={<SearchOutlined />}
                  size="small"
                  style={{ width: 220 }}
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  allowClear
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
              locale={{ emptyText: '暂无病灶与标注' }}
              renderItem={(item: LesionSummaryItem, i) => (
                <List.Item
                  key={item.id}
                  actions={[
                    <Tooltip key="loc" title="定位到关键帧">
                      <Button size="small" type="link" icon={<PictureOutlined />}
                        onClick={() => {
                          const kfId = item.frameId || case_.keyFrames[0]?.id
                          if (!kfId) return
                          const li = leftItems.findIndex(x => x.id === kfId)
                          if (li >= 0) { setLeftHistoryId('current'); setLeftImgIdx(li); message.info('已在左栏定位') }
                        }} />
                    </Tooltip>,
                    item.source === '手动标注' ? (
                      <Tooltip key="del" title="永久删除此标注（刷新后也不再出现）">
                        <Button size="small" type="link" danger icon={<DeleteOutlined />}
                          onClick={() => {
                            modal.confirm({
                              title: '确认删除标注？',
                              content: `${item.type}：${item.description}\n删除后将从当前视图、病灶汇总列表和本地存储中彻底移除，无法恢复。`,
                              okText: '永久删除',
                              okButtonProps: { danger: true },
                              cancelText: '取消',
                              onOk: () => {
                                if (case_ && item.annotation) {
                                  removeAnnotation(case_.id, item.annotation.id)
                                  message.success('标注已永久删除，并已保存到本地存储')
                                }
                              }
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
                      <Space wrap>
                        <span className={`lesion-tag type-${item.type === '息肉' ? 'polyp' : item.type === '炎症' ? 'inflammation' : item.type === '溃疡' ? 'ulcer' : item.type === '肿瘤' ? 'tumor' : item.type === '血管畸形' ? 'vascular' : 'other'}`}>
                          {item.type}
                        </span>
                        {item.grade && <Tag color="purple">{item.grade}</Tag>}
                        {item.isSuspicious && <Tag color="red" icon={<ExclamationCircleOutlined />}>疑似</Tag>}
                        <Tag color={item.source === '手动标注' ? 'cyan' : 'geekblue'}>
                          {item.source}
                        </Tag>
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
              <div>• 删除标注会从列表、图上和本地存储中彻底移除</div>
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
            <Button type="primary" onClick={confirmMarker} icon={<CheckCircleOutlined />}>确定添加并保存</Button>
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
            <Input.TextArea rows={4} placeholder="可补充大小、形态、NBI/染色特征等，备注会与标注一起持久化保存" />
          </Form.Item>
          <Divider />
          <div style={{ fontSize: 12, color: '#8c8c8c', lineHeight: 1.7 }}>
            {pendingPos && (
              <div>
                标注位置：X ≈ {pendingPos.x.toFixed(1)}%, Y ≈ {pendingPos.y.toFixed(1)}%
              </div>
            )}
            <div style={{ marginTop: 4, color: '#52c41a' }}>
              ✓ 标注将自动写入病例并保存在本地，关闭客户端后仍保留
            </div>
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
