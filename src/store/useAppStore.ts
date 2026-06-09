import { create } from 'zustand'
import type { CaseRecord, CaseStatus, ExamType, QCScores } from '../types'
import { caseRecords, doctors, qcRules, buildDoctorStats, buildMonthlySummary } from '../data/mockData'
import type { DoctorStats, MonthlySummary, ReportIssue, DisputeRecord } from '../types'

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
  markedAnnotations: Record<string, { x: number; y: number; r: number; type: string; label: string }[]>
  reviewScores: Record<string, QCScores>
  reviewComments: Record<string, string>
  customIssues: Record<string, ReportIssue[]>
  disputes: Record<string, DisputeRecord[]>
  doctorStats: DoctorStats[]
  monthlySummary: MonthlySummary[]

  setFilters: (f: Partial<FilterParams>) => void
  resetFilters: () => void
  setCurrentCase: (id?: string) => void
  getFilteredCases: () => CaseRecord[]
  getCurrentCase: () => CaseRecord | undefined

  toggleKeyFrame: (id: string) => void
  clearKeyFrames: () => void

  addAnnotation: (frameId: string, ann: { x: number; y: number; r: number; type: string; label: string }) => void
  removeAnnotation: (frameId: string, idx: number) => void

  setScore: (caseId: string, ruleId: string, score: number) => void
  setReviewComment: (caseId: string, comment: string) => void

  addCustomIssue: (caseId: string, issue: ReportIssue) => void
  removeCustomIssue: (caseId: string, issueId: string) => void

  addDispute: (caseId: string, dispute: DisputeRecord) => void
  resolveDispute: (caseId: string, disputeId: string, resolution: string) => void

  submitReview: (caseId: string, status: '已通过' | '已退回' | '争议中') => boolean
  calculateTotalScore: (caseId: string) => number
}

export const useAppStore = create<AppState>((set, get) => ({
  cases: [...caseRecords],
  filters: {},
  selectedKeyFrames: new Set(),
  markedAnnotations: {},
  reviewScores: {},
  reviewComments: {},
  customIssues: {},
  disputes: {},
  doctorStats: buildDoctorStats(),
  monthlySummary: buildMonthlySummary(6),

  setFilters: (f) => set(state => ({ filters: { ...state.filters, ...f } })),
  resetFilters: () => set({ filters: {} }),
  setCurrentCase: (id) => set({ currentCaseId: id, selectedKeyFrames: new Set() }),

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
      const order = { '待复核': 0, '复核中': 1, '争议中': 2, '已退回': 3, '已通过': 4 }
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
      return b.examDate.localeCompare(a.examDate)
    })
  },

  getCurrentCase: () => {
    const { cases, currentCaseId } = get()
    return cases.find(c => c.id === currentCaseId)
  },

  toggleKeyFrame: (id) => set(state => {
    const s = new Set(state.selectedKeyFrames)
    if (s.has(id)) s.delete(id); else s.add(id)
    return { selectedKeyFrames: s }
  }),
  clearKeyFrames: () => set({ selectedKeyFrames: new Set() }),

  addAnnotation: (frameId, ann) => set(state => ({
    markedAnnotations: {
      ...state.markedAnnotations,
      [frameId]: [...(state.markedAnnotations[frameId] || []), ann]
    }
  })),
  removeAnnotation: (frameId, idx) => set(state => {
    const arr = [...(state.markedAnnotations[frameId] || [])]
    arr.splice(idx, 1)
    return {
      markedAnnotations: {
        ...state.markedAnnotations,
        [frameId]: arr
      }
    }
  }),

  setScore: (caseId, ruleId, score) => set(state => ({
    reviewScores: {
      ...state.reviewScores,
      [caseId]: {
        ...(state.reviewScores[caseId] || {}),
        [ruleId]: score
      }
    }
  })),

  setReviewComment: (caseId, comment) => set(state => ({
    reviewComments: { ...state.reviewComments, [caseId]: comment }
  })),

  addCustomIssue: (caseId, issue) => set(state => ({
    customIssues: {
      ...state.customIssues,
      [caseId]: [...(state.customIssues[caseId] || []), issue]
    }
  })),
  removeCustomIssue: (caseId, issueId) => set(state => ({
    customIssues: {
      ...state.customIssues,
      [caseId]: (state.customIssues[caseId] || []).filter(i => i.id !== issueId)
    }
  })),

  addDispute: (caseId, dispute) => set(state => ({
    disputes: {
      ...state.disputes,
      [caseId]: [...(state.disputes[caseId] || state.cases.find(c => c.id === caseId)?.disputes || []), dispute]
    }
  })),
  resolveDispute: (caseId, disputeId, resolution) => set(state => {
    const caseDisputes = (state.disputes[caseId] || state.cases.find(c => c.id === caseId)?.disputes || [])
    return {
      disputes: {
        ...state.disputes,
        [caseId]: caseDisputes.map(d => d.id === disputeId ? { ...d, status: '已解决' as const, resolution } : d)
      }
    }
  }),

  submitReview: (caseId, status) => {
    const { calculateTotalScore } = get()
    const totalScore = calculateTotalScore(caseId)
    set(state => ({
      cases: state.cases.map(c => {
        if (c.id !== caseId) return c
        const newScores = { ...c.qcScores, ...(state.reviewScores[caseId] || {}) }
        return {
          ...c,
          status,
          qcScores: newScores,
          qcTotalScore: totalScore,
          reviewComment: state.reviewComments[caseId] || c.reviewComment,
          reviewer: '质控科张医生',
          reviewDate: new Date().toISOString().slice(0, 10),
          reportIssues: [...c.reportIssues, ...(state.customIssues[caseId] || [])],
          disputes: state.disputes[caseId] || c.disputes
        }
      })
    }))
    return true
  },

  calculateTotalScore: (caseId) => {
    const case_ = get().cases.find(c => c.id === caseId)
    if (!case_) return 0
    const merged = { ...case_.qcScores, ...(get().reviewScores[caseId] || {}) }
    return qcRules.reduce((sum, r) => sum + (merged[r.id] ?? r.maxScore), 0)
  }
}))

export { qcRules, doctors }
