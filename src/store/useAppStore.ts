import { create } from 'zustand'
import type {
  CaseRecord, CaseStatus, ExamType, QCScores, BroadcastEvent,
  ImageAnnotation, ReportIssue, DisputeRecord, LesionGradeRecord,
  BiopsyVerification, BiopsyAssessment
} from '../types'
import { caseRecords as initialCases, doctors, qcRules } from '../data/mockData'
import type { DoctorStats, MonthlySummary } from '../types'
import { buildDoctorStats, buildMonthlySummary } from '../data/mockData'

const STORAGE_KEY = 'endoscopy_qc_store_v1'
const BROADCAST_KEY = 'endoscopy_qc_broadcast_v1'
const CURRENT_CASE_KEY = 'endoscopy_qc_current_case_v1'

type PersistState = {
  cases: CaseRecord[]
  currentCaseId?: string
  savedAt: string
}

const loadPersisted = (): PersistState | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistState
    if (!parsed || !Array.isArray(parsed.cases) || parsed.cases.length === 0) return null
    return parsed
  } catch {
    return null
  }
}

const persist = (state: { cases: CaseRecord[]; currentCaseId?: string }) => {
  try {
    const data: PersistState = {
      cases: state.cases,
      currentCaseId: state.currentCaseId,
      savedAt: new Date().toISOString()
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('[QC Store] 持久化失败:', e)
  }
}

const broadcast = (event: BroadcastEvent) => {
  try {
    const payload = JSON.stringify({ ...event, __ts: Date.now() })
    localStorage.setItem(BROADCAST_KEY, payload)
    setTimeout(() => localStorage.removeItem(BROADCAST_KEY), 80)
  } catch {}
}

const mergeCases = (persisted: CaseRecord[], fresh: CaseRecord[]): CaseRecord[] => {
  const persMap = new Map(persisted.map(c => [c.id, c]))
  const result: CaseRecord[] = []
  fresh.forEach(fc => {
    const pc = persMap.get(fc.id)
    if (pc) {
      result.push({
        ...fc,
        status: pc.status,
        qcScores: pc.qcScores,
        qcTotalScore: pc.qcTotalScore,
        reviewComment: pc.reviewComment,
        reviewDate: pc.reviewDate,
        reviewer: pc.reviewer,
        reportIssues: [
          ...pc.reportIssues.filter(r => r.source === '手动添加' || r.fixed),
          ...fc.reportIssues.filter(r => !pc.reportIssues.some(pr => pr.id === r.id))
        ],
        disputes: pc.disputes.length > 0 ? pc.disputes : fc.disputes,
        imageAnnotations: pc.imageAnnotations || [],
        lesionGrades: { ...fc.lesionGrades, ...(pc.lesionGrades || {}) },
        biopsyVerifications: { ...fc.biopsyVerifications, ...(pc.biopsyVerifications || {}) },
        biopsyAssessment: pc.biopsyAssessment || fc.biopsyAssessment,
        lastModified: pc.lastModified || fc.lastModified
      })
    } else {
      result.push(fc)
    }
  })
  persisted.forEach(pc => {
    if (!fresh.some(fc => fc.id === pc.id)) {
      result.push(pc)
    }
  })
  return result
}

type FilterParams = {
  startDate?: string
  endDate?: string
  doctorId?: string
  examType?: ExamType
  status?: CaseStatus
  keyword?: string
}

interface AppState {
  cases: CaseRecord[]
  currentCaseId?: string
  filters: FilterParams
  selectedKeyFrames: Set<string>

  _hydrated: boolean
  _lastBroadcastTs: number

  setFilters: (f: Partial<FilterParams>) => void
  resetFilters: () => void
  setCurrentCase: (id?: string, broadcast_?: boolean) => void
  getFilteredCases: () => CaseRecord[]
  getCurrentCase: () => CaseRecord | undefined

  toggleKeyFrame: (frameId: string) => void
  clearKeyFrames: () => void

  _updateCase: (caseId: string, mutator: (c: CaseRecord) => void, notify?: boolean) => void

  addAnnotation: (caseId: string, ann: Omit<ImageAnnotation, 'id' | 'createdAt'>) => void
  removeAnnotation: (caseId: string, annotationId: string) => void

  setLesionGrade: (caseId: string, lesionId: string, data: Partial<LesionGradeRecord>) => void

  setBiopsyVerification: (caseId: string, bottleNo: string, data: Partial<BiopsyVerification>) => void
  setBiopsyAssessment: (caseId: string, assessment: BiopsyAssessment) => void

  addReportIssue: (caseId: string, issue: Omit<ReportIssue, 'id' | 'createdAt' | 'source' | 'fixed'>) => void
  removeReportIssue: (caseId: string, issueId: string) => void
  toggleIssueFixed: (caseId: string, issueId: string, fixed: boolean) => void

  setScore: (caseId: string, ruleId: string, score: number) => void
  setReviewComment: (caseId: string, comment: string) => void

  addDispute: (caseId: string, dispute: Omit<DisputeRecord, 'id' | 'timestamp' | 'status'>) => void
  resolveDispute: (caseId: string, disputeId: string, resolution: string) => void

  submitReview: (caseId: string, status: '已通过' | '已退回' | '争议中') => boolean
  calculateTotalScore: (caseId: string) => number

  doctorStats: DoctorStats[]
  monthlySummary: MonthlySummary[]
  refreshDerived: () => void
  hydrateFromStorage: () => void
}

const persisted = loadPersisted()

const initialStateCases = persisted
  ? mergeCases(persisted.cases, initialCases)
  : initialCases

export const useAppStore = create<AppState>((set, get) => ({
  cases: initialStateCases,
  currentCaseId: persisted?.currentCaseId || undefined,
  filters: {},
  selectedKeyFrames: new Set(),
  _hydrated: true,
  _lastBroadcastTs: 0,
  doctorStats: buildDoctorStats(),
  monthlySummary: buildMonthlySummary(6),

  setFilters: (f) => set(state => ({ filters: { ...state.filters, ...f } })),
  resetFilters: () => set({ filters: {} }),

  toggleKeyFrame: (frameId) => set(state => {
    const next = new Set(state.selectedKeyFrames)
    if (next.has(frameId)) next.delete(frameId)
    else next.add(frameId)
    return { selectedKeyFrames: next }
  }),
  clearKeyFrames: () => set({ selectedKeyFrames: new Set() }),

  setCurrentCase: (id, broadcast_ = true) => {
    set({ currentCaseId: id })
    try { localStorage.setItem(CURRENT_CASE_KEY, id || '') } catch {}
    if (broadcast_ && id) {
      broadcast({ type: 'CASE_CHANGED', caseId: id })
    }
    persist({ cases: get().cases, currentCaseId: id })
  },

  getFilteredCases: () => {
    const { cases, filters } = get()
    return cases.filter(c => {
      if (filters.startDate && c.examDate < filters.startDate) return false
      if (filters.endDate && c.examDate > filters.endDate) return false
      if (filters.doctorId && c.doctor.id !== filters.doctorId) return false
      if (filters.examType && c.examType !== filters.examType) return false
      if (filters.status && c.status !== filters.status) return false
      if (filters.keyword) {
        const kw = filters.keyword.toLowerCase()
        const matchStr = `${c.caseNo} ${c.patient.name} ${c.patient.medicalRecordNo} ${c.doctor.name} ${c.diagnosis}`.toLowerCase()
        if (!matchStr.includes(kw)) return false
      }
      return true
    }).sort((a, b) => {
      const order = { '待复核': 0, '复核中': 1, '争议中': 2, '已退回': 3, '已通过': 4 } as const
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
      if (b.lastModified !== a.lastModified) return b.lastModified.localeCompare(a.lastModified)
      return b.examDate.localeCompare(a.examDate)
    })
  },

  getCurrentCase: () => {
    const { cases, currentCaseId } = get()
    return cases.find(c => c.id === currentCaseId)
  },

  _updateCase: (caseId, mutator, notify = true) => {
    set(state => {
      const cases = state.cases.map(c => {
        if (c.id !== caseId) return c
        const clone: CaseRecord = JSON.parse(JSON.stringify(c))
        mutator(clone)
        clone.lastModified = new Date().toISOString()
        return clone
      })
      persist({ cases, currentCaseId: state.currentCaseId })
      if (notify) broadcast({ type: 'CASE_UPDATED', caseId })
      return { cases }
    })
    get().refreshDerived()
  },

  addAnnotation: (caseId, ann) => {
    get()._updateCase(caseId, c => {
      c.imageAnnotations.push({
        ...ann,
        id: 'ANN-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        createdAt: new Date().toISOString()
      })
    })
  },

  removeAnnotation: (caseId, annotationId) => {
    get()._updateCase(caseId, c => {
      c.imageAnnotations = c.imageAnnotations.filter(a => a.id !== annotationId)
    })
  },

  setLesionGrade: (caseId, lesionId, data) => {
    get()._updateCase(caseId, c => {
      const cur = c.lesionGrades[lesionId] || { lesionId, grade: '' }
      c.lesionGrades[lesionId] = { ...cur, ...data }
      const lesion = c.lesions.find(l => l.id === lesionId)
      if (lesion && data.grade && !lesion.grade) lesion.grade = data.grade
    })
  },

  setBiopsyVerification: (caseId, bottleNo, data) => {
    get()._updateCase(caseId, c => {
      const cur = c.biopsyVerifications[bottleNo] || { bottleNo, siteMatch: false, bottleMatch: false }
      c.biopsyVerifications[bottleNo] = { ...cur, ...data }
      const bioItem = c.biopsy.find(b => b.bottleNo === bottleNo)
      if (bioItem) bioItem.verified = c.biopsyVerifications[bottleNo].siteMatch && c.biopsyVerifications[bottleNo].bottleMatch
    })
  },

  setBiopsyAssessment: (caseId, assessment) => {
    get()._updateCase(caseId, c => {
      c.biopsyAssessment = assessment
    })
  },

  addReportIssue: (caseId, issue) => {
    get()._updateCase(caseId, c => {
      c.reportIssues.push({
        ...issue,
        id: 'ISS-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
        source: '手动添加',
        fixed: false,
        createdAt: new Date().toISOString()
      })
    })
  },

  removeReportIssue: (caseId, issueId) => {
    get()._updateCase(caseId, c => {
      c.reportIssues = c.reportIssues.filter(i => i.id !== issueId)
    })
  },

  toggleIssueFixed: (caseId, issueId, fixed) => {
    get()._updateCase(caseId, c => {
      const i = c.reportIssues.find(x => x.id === issueId)
      if (i) i.fixed = fixed
    })
  },

  setScore: (caseId, ruleId, score) => {
    get()._updateCase(caseId, c => {
      c.qcScores[ruleId] = score
      c.qcTotalScore = qcRules.reduce((s, r) => s + (c.qcScores[r.id] ?? r.maxScore), 0)
    })
  },

  setReviewComment: (caseId, comment) => {
    get()._updateCase(caseId, c => {
      c.reviewComment = comment
    })
  },

  addDispute: (caseId, dispute) => {
    get()._updateCase(caseId, c => {
      c.disputes.push({
        ...dispute,
        id: 'DIS-' + Date.now(),
        timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
        status: '待处理'
      })
      if (c.status === '已通过' || c.status === '待复核') c.status = '争议中'
    })
  },

  resolveDispute: (caseId, disputeId, resolution) => {
    get()._updateCase(caseId, c => {
      const d = c.disputes.find(x => x.id === disputeId)
      if (d) { d.status = '已解决'; d.resolution = resolution }
      if (c.status === '争议中' && c.disputes.every(x => x.status === '已解决')) {
        c.status = '复核中'
      }
    })
  },

  submitReview: (caseId, status) => {
    const totalScore = get().calculateTotalScore(caseId)
    get()._updateCase(caseId, c => {
      c.status = status
      c.qcTotalScore = totalScore
      c.reviewer = c.reviewer || '质控科张医生'
      c.reviewDate = new Date().toISOString().slice(0, 10)
    })
    broadcast({ type: 'DATA_REFRESHED' })
    return true
  },

  calculateTotalScore: (caseId) => {
    const case_ = get().cases.find(c => c.id === caseId)
    if (!case_) return 0
    return qcRules.reduce((sum, r) => sum + (case_.qcScores[r.id] ?? r.maxScore), 0)
  },

  refreshDerived: () => {
    const { cases } = get()
    const statsFn = new Function('cases', `return (${buildDoctorStats.toString()})(cases)`)
    const monthlyFn = new Function('cases', `return (${buildMonthlySummary.toString()})(6)`)
    try {
      set({
        doctorStats: buildDoctorStatsCustom(cases),
        monthlySummary: buildMonthlySummaryCustom(cases)
      })
    } catch {}
  },

  hydrateFromStorage: () => {
    const fresh = loadPersisted()
    if (!fresh) return
    const merged = mergeCases(fresh.cases, get().cases)
    set({ cases: merged, currentCaseId: fresh.currentCaseId || get().currentCaseId })
    get().refreshDerived()
  }
}))

function buildDoctorStatsCustom(cases: CaseRecord[]): DoctorStats[] {
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

function buildMonthlySummaryCustom(cases: CaseRecord[], monthsBack = 6): MonthlySummary[] {
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

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === BROADCAST_KEY && e.newValue) {
      try {
        const evt = JSON.parse(e.newValue) as BroadcastEvent & { __ts: number }
        if (!useAppStore.getState) return
        const state = useAppStore.getState()
        if (evt.__ts <= state._lastBroadcastTs) return
        if (evt.type === 'CASE_CHANGED') {
          if (state.currentCaseId !== evt.caseId) {
            useAppStore.setState({ currentCaseId: evt.caseId })
            try { localStorage.setItem(CURRENT_CASE_KEY, evt.caseId) } catch {}
            const hash = window.location.hash
            if (hash && !hash.includes('/pending-list') && !hash.includes('/statistics')) {
              const routeMatch = hash.match(/^#(\/[\w-]+)/)
              if (routeMatch) {
                const route = routeMatch[1]
                const qp = evt.caseId ? `?caseId=${evt.caseId}` : ''
                history.replaceState(null, '', '#' + route + qp)
                window.dispatchEvent(new HashChangeEvent('hashchange'))
                setTimeout(() => window.location.reload(), 80)
              }
            }
          }
        } else if (evt.type === 'CASE_UPDATED' || evt.type === 'DATA_REFRESHED') {
          state.hydrateFromStorage()
        }
        useAppStore.setState({ _lastBroadcastTs: evt.__ts })
      } catch {}
    }
  })

  const updateTitle = () => {
    const state = useAppStore.getState()
    const c = state.getCurrentCase()
    const hash = window.location.hash
    const routeTitles: Record<string, string> = {
      '/pending-list': '待复核列表',
      '/case-detail': '病例详情',
      '/image-compare': '图像对比',
      '/diagnosis': '诊断建议',
      '/report-proof': '报告校对',
      '/qc-score': '质控评分',
      '/statistics': '统计汇总'
    }
    const route = Object.keys(routeTitles).find(r => hash.includes(r)) || '/pending-list'
    const base = `消化内镜质控复核系统 - ${routeTitles[route]}`
    document.title = c && route !== '/pending-list' && route !== '/statistics'
      ? `${base} · ${c.caseNo} ${c.patient.name}`
      : base
  }

  useAppStore.subscribe(updateTitle)
  window.addEventListener('hashchange', updateTitle)
  updateTitle()
}

export { qcRules, doctors }
