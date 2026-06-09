import type {
  CaseRecord, Doctor, QCRule, ExamType, DoctorStats, MonthlySummary, LesionType, ReportIssue
} from '../types'

const placeholderImage = (seed: string) =>
  `https://picsum.photos/seed/${seed}/640/480`

const placeholderImageHd = (seed: string) =>
  `https://picsum.photos/seed/${seed}/800/600`

export const doctors: Doctor[] = [
  { id: 'D001', name: '张明', title: '主任医师', department: '消化内科', seniority: 20 },
  { id: 'D002', name: '李芳', title: '副主任医师', department: '消化内科', seniority: 15 },
  { id: 'D003', name: '王建国', title: '副主任医师', department: '消化内科', seniority: 12 },
  { id: 'D004', name: '刘薇', title: '主治医师', department: '消化内科', seniority: 8 },
  { id: 'D005', name: '陈志强', title: '主治医师', department: '消化内科', seniority: 6 },
  { id: 'D006', name: '赵雪梅', title: '主治医师', department: '消化内科', seniority: 9 },
  { id: 'D007', name: '孙大伟', title: '住院医师', department: '消化内科', seniority: 3 },
  { id: 'D008', name: '周丽华', title: '主任医师', department: '消化内科', seniority: 22 }
]

const examTypes: ExamType[] = ['胃镜', '结肠镜', '十二指肠镜', '小肠镜', '超声内镜']

const surnames = ['张', '王', '李', '赵', '刘', '陈', '杨', '黄', '周', '吴', '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗']
const givenNames = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '洋', '艳', '勇', '军', '杰', '娟', '涛', '明', '超', '秀英', '霞', '平']

const randomPatient = (idx: number) => {
  const surname = surnames[Math.floor(Math.random() * surnames.length)]
  const given = givenNames[Math.floor(Math.random() * givenNames.length)]
  return {
    id: `P${String(idx).padStart(5, '0')}`,
    name: surname + given,
    gender: (Math.random() > 0.5 ? '男' : '女') as '男' | '女',
    age: 30 + Math.floor(Math.random() * 60),
    idCard: `3301${String(Math.floor(Math.random() * 999999999999)).padStart(14, '0')}`,
    phone: `1${String(Math.floor(Math.random() * 999999999)).padStart(9, '0')}`,
    medicalRecordNo: `M${String(20250000 + idx).padStart(8, '0')}`
  }
}

const lesionTypes: LesionType[] = ['息肉', '炎症', '溃疡', '肿瘤', '血管畸形', '其他']

const keyFrameDescriptions = [
  '食管上段 - 黏膜光滑，血管纹理清晰',
  '食管中段 - 正常齿状线',
  '贲门 - 开闭良好',
  '胃底 - 黏液湖清亮',
  '胃体大弯侧 - 黏膜皱襞规整',
  '胃角 - 形态完整',
  '胃窦 - 轻度充血水肿',
  '幽门 - 圆形，开闭正常',
  '十二指肠球部 - 未见异常',
  '降部 - 乳头形态正常',
  '回盲部 - 回盲瓣清晰可见',
  '升结肠 - 发现息肉样隆起',
  '横结肠 - 黏膜正常',
  '降结肠 - 小憩室',
  '乙状结肠 - 多发息肉',
  '直肠 - 血管纹理清晰'
]

const lesionLocations = [
  '胃窦前壁', '胃体后壁', '胃角小弯侧', '胃底大弯侧',
  '升结肠近肝曲', '横结肠中段', '降结肠近脾曲',
  '乙状结肠下段', '直肠距肛门8cm处', '食管下段距门齿35cm',
  '十二指肠球部前壁', '回盲部'
]

const biopsySites = [
  '胃窦2块', '胃体1块', '食管1块', '升结肠3块',
  '横结肠1块', '乙状结肠2块', '直肠2块', '胃角2块'
]

const diagnosisTexts = [
  '慢性非萎缩性胃炎伴糜烂',
  '结肠多发息肉（山田Ⅰ-Ⅱ型），已行EMR切除',
  '胃息肉（山田Ⅰ型），已行氩气烧灼',
  '胃溃疡（A1期），建议4-6周后复查',
  '反流性食管炎（LA-B级）',
  '溃疡性结肠炎（直肠乙状结肠型，活动期）',
  '慢性萎缩性胃炎伴肠上皮化生，建议1年后复查',
  '十二指肠球部溃疡（H2期）',
  '结肠侧向发育型肿瘤（LST），建议ESD治疗',
  'Barrett食管，建议定期随访'
]

const reportText = (diagnosis: string, indication: string) => `
# 内镜检查报告

## 一、基本信息
- 就诊科室：消化内科
- 检查指征：${indication}

## 二、内镜所见
### ${diagnosis.includes('胃') || diagnosis.includes('食管') || diagnosis.includes('贲门') ? '胃镜检查' : '肠镜检查'}：
进镜顺利，依次观察各部位黏膜情况。${diagnosis.includes('息肉') ? '发现息肉样病变，已根据形态采取相应治疗措施。' : ''}
${diagnosis.includes('溃疡') ? '发现溃疡病灶，取活检送病理检查。' : ''}
退镜观察，未见活动性出血。

## 三、诊断
1. ${diagnosis}
${diagnosis.includes('多发') ? '2. 建议术后1年复查内镜' : ''}

## 四、建议
1. ${diagnosis.includes('溃疡') ? '规律服药4-8周，注意饮食' : '清淡饮食，避免辛辣刺激食物'}
2. 病理报告回报后门诊复诊
3. 如有腹痛、黑便等不适及时就诊
`

const indicationTexts = [
  '反复上腹痛3月',
  '健康体检',
  '大便潜血阳性',
  '反酸、烧心2周',
  '腹泻、便秘交替半年',
  '胃癌家族史筛查',
  '排便习惯改变',
  '消瘦原因待查',
  '腹胀、纳差1月',
  '结直肠癌术后复查'
]

const aiSugPool = [
  '提示：胃窦处病变周围黏膜皱襞集中，建议加做NBI放大观察',
  '建议：该息肉形态为侧向发育型，基底较宽，建议ESD治疗而非EMR',
  '提示：溃疡边界不规则，底部凹凸不平，需警惕恶性可能，建议多块活检',
  '建议：该部位血管纹理中断，需与早期食管癌鉴别',
  '提示：已行活检3块，但病灶范围较大，建议追加取材确保诊断准确性'
]

export const qcRules: QCRule[] = [
  { id: 'R001', category: '术前准备', item: '适应证掌握合理', maxScore: 5, description: '检查指征明确，无过度检查' },
  { id: 'R002', category: '术前准备', item: '肠道准备质量（肠镜）', maxScore: 10, description: '波士顿评分≥6分，肠道清洁度良好' },
  { id: 'R003', category: '操作规范', item: '进镜深度符合规范', maxScore: 10, description: '胃镜抵达十二指肠降段，肠镜抵达回盲部' },
  { id: 'R004', category: '操作规范', item: '操作时长适宜', maxScore: 5, description: '结肠镜退镜时间≥6分钟' },
  { id: 'R005', category: '操作规范', item: '关键部位留图完整', maxScore: 10, description: '解剖标志清晰，关键病变多角度留图' },
  { id: 'R006', category: '病变识别', item: '息肉/病变检出率', maxScore: 15, description: '不低于同级别医生平均水平' },
  { id: 'R007', category: '病变识别', item: '病变描述规范', maxScore: 10, description: '大小、部位、形态、颜色等描述准确' },
  { id: 'R008', category: '活检取材', item: '活检指征恰当', maxScore: 10, description: '疑似病变均取活检，取材位置准确' },
  { id: 'R009', category: '活检取材', item: '取材完整性', maxScore: 10, description: '活检块数足够，标本送检规范' },
  { id: 'R010', category: '报告规范', item: '诊断术语准确', maxScore: 10, description: '使用标准术语，无前后不一致' },
  { id: 'R011', category: '报告规范', item: '诊疗建议合理', maxScore: 10, description: '随访计划、治疗建议科学合理' },
  { id: 'R012', category: '不良事件', item: '无并发症/并发症处理得当', maxScore: 5, description: '出血、穿孔等并发症处理及时规范' }
]

const issueTypeList: ReportIssue['type'][] = ['术语不一致', '描述缺失', '分级错误', '活检瓶编号问题', '其他']

function generateCase(idx: number): CaseRecord {
  const patient = randomPatient(idx)
  const doctor = doctors[Math.floor(Math.random() * doctors.length)]
  const examType = examTypes[Math.floor(Math.random() * (idx < 5 ? 2 : examTypes.length))]

  const daysAgo = Math.floor(Math.random() * 60)
  const examDate = new Date()
  examDate.setDate(examDate.getDate() - daysAgo)
  const startTime = new Date(examDate)
  startTime.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60))
  const endTime = new Date(startTime)
  endTime.setMinutes(startTime.getMinutes() + 15 + Math.floor(Math.random() * 45))

  const statusPool: CaseRecord['status'][] = ['待复核', '待复核', '待复核', '复核中', '已通过', '已退回', '争议中']
  const status = statusPool[Math.floor(Math.random() * statusPool.length)]

  const indication = indicationTexts[Math.floor(Math.random() * indicationTexts.length)]
  const diagnosis = diagnosisTexts[Math.floor(Math.random() * diagnosisTexts.length)]

  const keyFrameCount = 8 + Math.floor(Math.random() * 8)
  const selectedDescriptions = [...keyFrameDescriptions].sort(() => Math.random() - 0.5).slice(0, keyFrameCount)
  const keyFrames = selectedDescriptions.map((desc, i) => ({
    id: `KF${idx}-${i}`,
    timestamp: `00:${String((i + 1) * 3).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
    description: desc,
    imageUrl: placeholderImage(`case${idx}f${i}`),
    lesionMarked: Math.random() > 0.7
  }))

  const hasLesion = Math.random() > 0.3
  const lesionCount = hasLesion ? 1 + Math.floor(Math.random() * 3) : 0
  const lesions: CaseRecord['lesions'] = Array.from({ length: lesionCount }, (_, i) => {
    const type = lesionTypes[Math.floor(Math.random() * (lesionTypes.length - 1))]
    let grade: string | undefined
    if (type === '息肉') grade = ['Ⅰ型', 'Ⅱa型', 'Ⅱb型', 'Ⅱc型'][Math.floor(Math.random() * 4)]
    else if (type === '炎症') grade = ['轻度', '中度', '重度'][Math.floor(Math.random() * 3)]
    else if (type === '溃疡') grade = ['活动期(A1/A2)', '愈合期(H1/H2)', '瘢痕期(S1/S2)'][Math.floor(Math.random() * 3)]
    return {
      id: `L${idx}-${i}`,
      type,
      location: lesionLocations[Math.floor(Math.random() * lesionLocations.length)],
      size: `${(Math.random() * 3 + 0.3).toFixed(1)}cm`,
      description: `黏膜${type === '息肉' ? '隆起性' : type === '溃疡' ? '凹陷性' : '充血'}病变，边界${Math.random() > 0.5 ? '清晰' : '尚清晰'}`,
      grade,
      imageIndex: Math.floor(Math.random() * keyFrames.length),
      isSuspicious: Math.random() > 0.75
    }
  })

  const biopsyCount = hasLesion && Math.random() > 0.4 ? 1 + Math.floor(Math.random() * 4) : 0
  const biopsy: CaseRecord['biopsy'] = Array.from({ length: biopsyCount }, (_, i) => {
    const siteInfo = biopsySites[Math.floor(Math.random() * biopsySites.length)]
    const match = siteInfo.match(/(.+?)(\d+)块/)
    return {
      bottleNo: `B${idx}-${i + 1}`,
      site: match ? match[1] : siteInfo,
      pieces: match ? parseInt(match[2]) : 1,
      description: siteInfo,
      verified: Math.random() > 0.15
    }
  })

  const reportIssueCount = status === '待复核'
    ? (Math.random() > 0.4 ? Math.floor(Math.random() * 3) + 1 : 0)
    : Math.floor(Math.random() * 4)
  const nowStr = new Date().toISOString()
  const reportIssues: CaseRecord['reportIssues'] = Array.from({ length: reportIssueCount }, (_, i) => {
    const type = issueTypeList[Math.floor(Math.random() * issueTypeList.length)]
    const severityPool: ('高' | '中' | '低')[] = type === '分级错误' || type === '活检瓶编号问题'
      ? ['高', '中'] : ['中', '低', '低']
    const severity = severityPool[Math.floor(Math.random() * severityPool.length)]
    const fieldMap: Record<string, string[]> = {
      '术语不一致': ['诊断', '病变描述', '部位描述'],
      '描述缺失': ['病变大小', '形态描述', '颜色描述'],
      '分级错误': ['息肉分型', '溃疡分期', '炎症程度'],
      '活检瓶编号问题': ['瓶号重复', '瓶号缺失', '瓶号与申请单不符'],
      '其他': ['报告内容', '随访建议', '治疗建议']
    }
    const fields = fieldMap[type]
    const field = fields[Math.floor(Math.random() * fields.length)]
    return {
      id: `I${idx}-${i}`,
      type,
      severity,
      field,
      original: '原描述内容存在不规范之处',
      suggestion: '建议使用标准术语重新描述',
      description: `${field}存在${type}问题，可能影响报告准确性`,
      source: '系统检测' as const,
      fixed: false,
      createdAt: nowStr
    }
  })

  const qcScores: Record<string, number> = {}
  qcRules.forEach(r => {
    const baseScore = r.maxScore
    const deduction = Math.random() > (status === '已通过' ? 0.8 : 0.45)
      ? Math.floor(Math.random() * Math.ceil(r.maxScore / 2)) + 1
      : 0
    qcScores[r.id] = baseScore - deduction
  })
  const qcTotalScore = Object.values(qcScores).reduce((a, b) => a + b, 0)

  const hasHistory = Math.random() > 0.5
  const historyCount = hasHistory ? 1 + Math.floor(Math.random() * 2) : 0
  const historyExams: CaseRecord['historyExams'] = Array.from({ length: historyCount }, (_, i) => {
    const histDate = new Date(examDate)
    histDate.setMonth(histDate.getMonth() - (6 + i * 6) - Math.floor(Math.random() * 12))
    return {
      id: `H${idx}-${i}`,
      date: histDate.toISOString().slice(0, 10),
      type: examTypes[Math.floor(Math.random() * (examType.includes('胃') ? 2 : 5))],
      diagnosis: diagnosisTexts[Math.floor(Math.random() * diagnosisTexts.length)],
      imageUrls: [placeholderImage(`h${idx}${i}a`), placeholderImage(`h${idx}${i}b`), placeholderImage(`h${idx}${i}c`)]
    }
  })

  const disputeCount = status === '争议中' ? 1 + Math.floor(Math.random() * 2) : 0
  const disputes: CaseRecord['disputes'] = Array.from({ length: disputeCount }, (_, i) => ({
    id: `D${idx}-${i}`,
    reviewer: '质控科李主任',
    reason: [
      '诊断分级与内镜下表现不一致',
      '病变性质判断存在分歧',
      '活检取材位置需进一步确认',
      '治疗方案选择合理性存疑'
    ][Math.floor(Math.random() * 4)],
    timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
    status: (['待处理', '已解决', '升级处理'] as const)[Math.floor(Math.random() * 3)],
    resolution: Math.random() > 0.5 ? '已与操作医生沟通，达成一致意见' : undefined
  }))

  const aiSuggestionCount = 1 + Math.floor(Math.random() * 3)

  return {
    id: `C${String(idx).padStart(6, '0')}`,
    caseNo: `NJ${examDate.getFullYear()}${String(idx).padStart(6, '0')}`,
    patient,
    examType,
    doctor,
    assistant: ['护士小王', '护士小李', '护士小陈', '护士小刘'][Math.floor(Math.random() * 4)],
    examDate: examDate.toISOString().slice(0, 10),
    startTime: startTime.toTimeString().slice(0, 5),
    endTime: endTime.toTimeString().slice(0, 5),
    status,
    indication,
    procedure: examType.includes('胃')
      ? '患者左侧卧位，经口进镜，依次观察食管、贲门、胃底、胃体、胃角、胃窦、幽门、十二指肠球部及降段，过程顺利，患者耐受可。'
      : '患者左侧卧位，经肛门进镜，循腔进镜至回盲部，观察回盲瓣及阑尾开口，退镜依次观察各段结肠黏膜，过程顺利，患者耐受可。',
    keyFrames,
    lesions,
    biopsy,
    diagnosis,
    originalReport: reportText(diagnosis, indication),
    historyExams,
    reportIssues,
    qcScores,
    qcTotalScore,
    reviewComment: status === '已通过' || status === '已退回'
      ? (status === '已通过' ? '报告规范，诊断准确，同意发布。' : '报告存在以下问题，请修改后重新提交。')
      : '',
    disputes,
    reviewDate: status !== '待复核' && status !== '复核中'
      ? examDate.toISOString().slice(0, 10)
      : undefined,
    reviewer: status !== '待复核' && status !== '复核中' ? '质控科张医生' : undefined,
    aiSuggestions: aiSugPool.sort(() => Math.random() - 0.5).slice(0, aiSuggestionCount),
    imageAnnotations: [],
    lesionGrades: Object.fromEntries(
      lesions.map(l => [l.id, {
        lesionId: l.id,
        grade: l.grade || '',
        sizeMm: parseFloat(l.size) || undefined,
        biopsyRecommended: ['肿瘤', '溃疡', '息肉'].includes(l.type),
        requiredPieces: ['肿瘤', '溃疡'].includes(l.type) ? 4 : 2,
        remark: ''
      }])
    ),
    biopsyVerifications: Object.fromEntries(
      biopsy.map(b => [b.bottleNo, {
        bottleNo: b.bottleNo,
        siteMatch: !!b.verified,
        enoughPieces: true,
        bottleMatch: !!b.verified
      }])
    ),
    biopsyAssessment: {
      completeness: 100,
      warnings: [],
      verified: true
    },
    lastModified: new Date().toISOString()
  }
}

export const caseRecords: CaseRecord[] = Array.from({ length: 50 }, (_, i) => generateCase(i + 1))

export function buildDoctorStats(cases: CaseRecord[] = caseRecords): DoctorStats[] {
  return doctors.map(d => {
    const doctorCases = cases.filter(c => c.doctor.id === d.id)
    const totalCases = doctorCases.length
    const passedCases = doctorCases.filter(c => c.status === '已通过').length
    const returnedCases = doctorCases.filter(c => c.status === '已退回').length
    const disputedCases = doctorCases.filter(c => c.status === '争议中').length
    const avgScore = totalCases
      ? doctorCases.reduce((s, c) => s + c.qcTotalScore, 0) / totalCases
      : 0

    const monthMap = new Map<string, { total: number; scoreSum: number }>()
    doctorCases.forEach(c => {
      const m = c.examDate.slice(0, 7)
      if (!monthMap.has(m)) monthMap.set(m, { total: 0, scoreSum: 0 })
      const rec = monthMap.get(m)!
      rec.total++
      rec.scoreSum += c.qcTotalScore
    })
    const casesByMonth = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        count: v.total,
        avgScore: v.total ? v.scoreSum / v.total : 0
      }))

    const issueCount = new Map<string, number>()
    doctorCases.forEach(c => {
      c.reportIssues.forEach(i => {
        const k = `${i.type}-${i.field}`
        issueCount.set(k, (issueCount.get(k) || 0) + 1)
      })
    })
    const commonIssues = Array.from(issueCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue, count]) => ({ issue, count }))

    return {
      doctorId: d.id,
      doctorName: d.name,
      totalCases,
      passedCases,
      returnedCases,
      disputedCases,
      avgScore,
      casesByMonth,
      commonIssues
    }
  })
}

export function buildMonthlySummary(monthsBack: number = 6, cases: CaseRecord[] = caseRecords): MonthlySummary[] {
  const result: MonthlySummary[] = []
  for (let m = monthsBack - 1; m >= 0; m--) {
    const d = new Date()
    d.setMonth(d.getMonth() - m)
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthCases = cases.filter(c => c.examDate.startsWith(monthStr))
    const totalCases = monthCases.length
    const reviewedCases = monthCases.filter(c => c.status !== '待复核' && c.status !== '复核中').length
    const passedCases = monthCases.filter(c => c.status === '已通过').length
    const returnedCases = monthCases.filter(c => c.status === '已退回').length
    const disputedCases = monthCases.filter(c => c.status === '争议中').length

    const passRate = reviewedCases ? passedCases / reviewedCases : 0
    const returnRate = reviewedCases ? returnedCases / reviewedCases : 0
    const disputeRate = reviewedCases ? disputedCases / reviewedCases : 0
    const avgScore = reviewedCases
      ? monthCases.filter(c => c.status !== '待复核').reduce((s, c) => s + c.qcTotalScore, 0) / reviewedCases
      : 0

    const problemCount = new Map<string, number>()
    monthCases.forEach(c => c.reportIssues.forEach(i => {
      problemCount.set(i.type, (problemCount.get(i.type) || 0) + 1)
    }))
    const totalIssues = Array.from(problemCount.values()).reduce((a, b) => a + b, 0) || 1
    const commonProblems = Array.from(problemCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([problem, count]) => ({ problem, count, rate: count / totalIssues }))

    const doctorCaseMap = new Map<string, { cases: CaseRecord[] }>()
    monthCases.forEach(c => {
      if (!doctorCaseMap.has(c.doctor.id)) doctorCaseMap.set(c.doctor.id, { cases: [] })
      doctorCaseMap.get(c.doctor.id)!.cases.push(c)
    })
    const doctorRankings = Array.from(doctorCaseMap.entries())
      .map(([did, { cases }]) => {
        const dc = doctors.find(x => x.id === did)!
        const rev = cases.filter(c => c.status !== '待复核' && c.status !== '复核中')
        const pass = cases.filter(c => c.status === '已通过').length
        return {
          doctorName: dc.name,
          cases: cases.length,
          avgScore: rev.length ? rev.reduce((s, c) => s + c.qcTotalScore, 0) / rev.length : 0,
          passRate: rev.length ? pass / rev.length : 0
        }
      })
      .sort((a, b) => b.avgScore - a.avgScore)

    result.push({
      month: monthStr,
      totalCases,
      reviewedCases,
      passRate,
      returnRate,
      disputeRate,
      avgScore,
      commonProblems,
      doctorRankings
    })
  }
  return result
}

export const placeholderImages = {
  hd: placeholderImageHd,
  normal: placeholderImage
}
