import { create } from 'zustand'
import type {
  CaseRecord, CaseStatus, ExamType, QCScores, BroadcastEvent,
  ImageAnnotation, ReportIssue, DisputeRecord, LesionGradeRecord,
  BiopsyVerification, BiopsyAssessment, AuditLog
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
  const freshMap = new Map(fresh.map(c => [c.id, c]))
  const result: CaseRecord[] = []

  persisted.forEach(pc => {
    const fc = freshMap.get(pc.id)
    result.push({
      ...pc,
      imageAnnotations: pc.imageAnnotations ?? [],
      lesionGrades: pc.lesionGrades ?? {},
      biopsyVerifications: pc.biopsyVerifications ?? {},
      biopsyAssessment: pc.biopsyAssessment,
      auditLogs: pc.auditLogs ?? [],
      lastModified: pc.lastModified || (fc ? fc.lastModified : new Date().toISOString()),
      reportIssues: Array.isArray(pc.reportIssues) && pc.reportIssues.length > 0
        ? pc.reportIssues
        : (fc ? fc.reportIssues : [])
    })
  })

  fresh.forEach(fc => {
    if (!persMap.has(fc.id)) {
      result.push(fc)
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

  addAuditLog: (caseId: string, log: Omit<AuditLog, 'id' | 'timestamp'>) => void

  submitReview: (caseId: string, status: '已通过' | '已退回' | '争议中') => boolean
  calculateTotalScore: (caseId: string) => number

  filterStatsCases: (query: { doctorId?: string; month?: string; issueType?: string; status?: CaseStatus }) => CaseRecord[]

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
  doctorStats: buildDoctorStats(initialStateCases),
  monthlySummary: buildMonthlySummary(6, initialStateCases),

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
    const case_ = get().cases.find(c => c.id === caseId)
    const reviewer = case_?.reviewer || '质控科张医生'
    get()._updateCase(caseId, c => {
      const d = c.disputes.find(x => x.id === disputeId)
      if (d) { d.status = '已解决'; d.resolution = resolution }
      if (c.status === '争议中' && c.disputes.every(x => x.status === '已解决')) {
        c.status = '复核中'
      }
    })
    get().addAuditLog(caseId, { action: '争议解决', operator: reviewer, note: resolution })
  },

  addAuditLog: (caseId, log) => {
    get()._updateCase(caseId, c => {
      c.auditLogs = c.auditLogs || []
      c.auditLogs.unshift({
        ...log,
        id: 'LOG-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString().slice(0, 19).replace('T', ' ')
      })
    })
  },

  submitReview: (caseId, status) => {
    const case_ = get().cases.find(c => c.id === caseId)
    const fromStatus = case_?.status
    const reviewer = case_?.reviewer || '质控科张医生'
    const totalScore = get().calculateTotalScore(caseId)
    get()._updateCase(caseId, c => {
      c.status = status
      c.qcTotalScore = totalScore
      c.reviewer = reviewer
      c.reviewDate = new Date().toISOString().slice(0, 10)
    })
    get().addAuditLog(caseId, {
      action: '状态变更',
      operator: reviewer,
      fromStatus,
      toStatus: status,
      totalScore,
      comment: case_?.reviewComment || ''
    })
    broadcast({ type: 'DATA_REFRESHED' })
    return true
  },

  calculateTotalScore: (caseId) => {
    const case_ = get().cases.find(c => c.id === caseId)
    if (!case_) return 0
    return qcRules.reduce((sum, r) => sum + (case_.qcScores[r.id] ?? r.maxScore), 0)
  },

  filterStatsCases: (query) => {
    const { cases } = get()
    return cases.filter(c => {
      if (query.doctorId && c.doctor.id !== query.doctorId) return false
      if (query.month && !c.examDate.startsWith(query.month)) return false
      if (query.status && c.status !== query.status) return false
      if (query.issueType && !c.reportIssues.some(i => i.type === query.issueType)) return false
      return true
    })
  },

  refreshDerived: () => {
    const { cases } = get()
    set({
      doctorStats: buildDoctorStats(cases),
      monthlySummary: buildMonthlySummary(6, cases)
    })
  },

  hydrateFromStorage: () => {
    const fresh = loadPersisted()
    if (!fresh) return
    const merged = mergeCases(fresh.cases, get().cases)
    set({ cases: merged, currentCaseId: fresh.currentCaseId || get().currentCaseId })
    get().refreshDerived()
  }
}))

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
