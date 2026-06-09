export type ExamType = '胃镜' | '结肠镜' | '十二指肠镜' | '小肠镜' | '超声内镜'

export type CaseStatus = '待复核' | '复核中' | '已通过' | '已退回' | '争议中'

export type LesionType = '息肉' | '炎症' | '溃疡' | '肿瘤' | '血管畸形' | '其他'

export type PolypGrade = 'Ⅰ型' | 'Ⅱa型' | 'Ⅱb型' | 'Ⅱc型' | 'Ⅲ型'
export type InflammationGrade = '轻度' | '中度' | '重度'
export type UlcerStage = '活动期(A1/A2)' | '愈合期(H1/H2)' | '瘢痕期(S1/S2)'

export interface Doctor {
  id: string
  name: string
  title: string
  department: string
  seniority: number
}

export interface Patient {
  id: string
  name: string
  gender: '男' | '女'
  age: number
  idCard: string
  phone: string
  medicalRecordNo: string
}

export interface KeyFrame {
  id: string
  timestamp: string
  description: string
  imageUrl: string
  lesionMarked?: boolean
}

export interface Lesion {
  id: string
  type: LesionType
  location: string
  size: string
  description: string
  grade?: string
  imageIndex?: number
  isSuspicious?: boolean
}

export interface BiopsyItem {
  bottleNo: string
  site: string
  pieces: number
  description: string
  verified?: boolean
}

export interface HistoryExam {
  id: string
  date: string
  type: ExamType
  diagnosis: string
  imageUrls: string[]
}

export interface ReportIssue {
  id: string
  type: '术语不一致' | '描述缺失' | '分级错误' | '活检瓶编号问题' | '其他'
  severity: '高' | '中' | '低'
  field: string
  original: string
  suggestion: string
  description: string
  source?: '系统检测' | '手动添加'
  fixed?: boolean
  createdAt?: string
}

export interface QCRule {
  id: string
  category: string
  item: string
  maxScore: number
  description: string
}

export interface QCScores {
  [ruleId: string]: number
}

export interface DisputeRecord {
  id: string
  reviewer: string
  reason: string
  timestamp: string
  status: '待处理' | '已解决' | '升级处理'
  resolution?: string
}

export interface ImageAnnotation {
  id: string
  frameId: string
  x: number
  y: number
  r: number
  type: LesionType
  label: string
  note?: string
  createdAt: string
}

export interface LesionGradeRecord {
  lesionId: string
  grade: string
  sizeMm?: number
  biopsyRecommended?: boolean
  requiredPieces?: number
  marginClear?: boolean
  remark?: string
}

export interface BiopsyVerification {
  bottleNo: string
  siteMatch: boolean
  enoughPieces?: boolean
  bottleMatch: boolean
}

export interface BiopsyAssessment {
  completeness: number
  warnings: string[]
  verified: boolean
}

export interface CaseRecord {
  id: string
  caseNo: string
  patient: Patient
  examType: ExamType
  doctor: Doctor
  assistant: string
  examDate: string
  startTime: string
  endTime: string
  status: CaseStatus
  indication: string
  procedure: string
  keyFrames: KeyFrame[]
  lesions: Lesion[]
  biopsy: BiopsyItem[]
  diagnosis: string
  originalReport: string
  historyExams: HistoryExam[]
  reportIssues: ReportIssue[]
  qcScores: QCScores
  qcTotalScore: number
  reviewComment: string
  disputes: DisputeRecord[]
  reviewDate?: string
  reviewer?: string
  aiSuggestions?: string[]
  imageAnnotations: ImageAnnotation[]
  lesionGrades: Record<string, LesionGradeRecord>
  biopsyVerifications: Record<string, BiopsyVerification>
  biopsyAssessment?: BiopsyAssessment
  lastModified: string
}

export interface DoctorStats {
  doctorId: string
  doctorName: string
  totalCases: number
  passedCases: number
  returnedCases: number
  disputedCases: number
  avgScore: number
  casesByMonth: { month: string; count: number; avgScore: number }[]
  commonIssues: { issue: string; count: number }[]
}

export interface MonthlySummary {
  month: string
  totalCases: number
  reviewedCases: number
  passRate: number
  returnRate: number
  disputeRate: number
  avgScore: number
  commonProblems: { problem: string; count: number; rate: number }[]
  doctorRankings: { doctorName: string; cases: number; avgScore: number; passRate: number }[]
}

export type BroadcastEvent =
  | { type: 'CASE_CHANGED'; caseId: string }
  | { type: 'CASE_UPDATED'; caseId: string }
  | { type: 'DATA_REFRESHED' }
  | { type: 'PING' }
