/** Shapes returned by the Spring Boot API. */

export type QuestionType = "tf" | "single" | "multi";

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: "USER" | "ADMIN";
  provider?: "LOCAL" | "GOOGLE";
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface AuthResponse extends AuthUser {
  token: string;
  type: string;
}

/** Top of the catalogue: Subject -> Exam -> Paper (year). */
export interface Subject {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  examCount: number;
  paperCount: number;
  questionCount: number;
}

export interface Exam {
  id: number;
  title: string;
  description: string | null;
  subjectId: number | null;
  subjectName: string | null;
  createdAt: string;
  paperCount: number;
  questionCount: number;
}

export interface Paper {
  id: number;
  title: string;
  description: string | null;
  year: number | null;
  /** Sitting length in minutes, set by an admin. Null means untimed. */
  durationMinutes: number | null;
  examId: number;
  examTitle: string;
  subjectId: number | null;
  subjectName: string | null;
  createdAt: string;
  questionCount: number;
}

export interface Option {
  id: number;
  label: string;
  text: string;
  textSi: string | null;
  imageUrl: string | null;
  correct: boolean | null;
  explanationEn: string | null;
  explanationSi: string | null;
}

export interface Question {
  id: number;
  type: QuestionType;
  stem: string;
  stemSi: string | null;
  note: string | null;
  noteSi: string | null;
  imageUrl: string | null;
  explanation: string | null;
  explanationSi: string | null;
  paperId: number | null;
  paperTitle: string | null;
  subjectId: number | null;
  subjectName: string | null;
  options: Option[];
}

export interface QuizAttemptSummary {
  attemptId: number;
  paperId: number;
  paperTitle: string;
  totalQuestions: number;
  correctCount: number;
  totalMarks: number;
  earnedMarks: number;
  scorePct: number;
  startedAt: string;
  completedAt: string | null;
}

export interface StartQuizResponse {
  attemptId: number;
  paperId: number;
  paperTitle: string;
  totalQuestions: number;
}

/** One question's answers on submit. `optionAnswers` carries True/False verdicts for `tf`. */
export interface AnswerSubmission {
  questionId: number;
  selectedOptionIds?: number[];
  optionAnswers?: Record<number, boolean>;
}

// --- admin ---------------------------------------------------------------

export interface AdminStats {
  members: {
    total: number;
    active: number;
    activeThisWeek: number;
    newThisWeek: number;
    admins: number;
    suspended: number;
    neverSignedIn: number;
  };
  content: { subjects: number; exams: number; papers: number; questions: number };
  activity: { totalAttempts: number; completedAttempts: number; averageScorePct: number };
  recentSignups: AdminUser[];
  recentAttempts: {
    attemptId: number;
    username: string;
    paperTitle: string;
    earnedMarks: number;
    totalMarks: number;
    scorePct: number;
    completedAt: string | null;
  }[];
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: "USER" | "ADMIN";
  provider: "LOCAL" | "GOOGLE";
  enabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  attemptCount: number;
  bestScorePct: number | null;
}

export interface Paged<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** One question in an uploaded paper file. Matches the seed JSON shape. */
/** Which questions in a paper still need a person to fix them, and why. */
export interface PaperReview {
  paperId: number;
  paperTitle: string;
  questionCount: number;
  needsAttention: number;
  questions: {
    questionId: number;
    /** Position in the paper, 1-based — what the editor shows as "Q7". */
    number: number;
    type: string;
    preview: string;
    reasons: string[];
  }[];
}

export interface ImportQuestion {
  type?: string;
  stem?: string;
  note?: string | null;
  exp?: string | null;
  exp_si?: string | null;
  stem_si?: string | null;
  note_si?: string | null;
  options?: {
    L?: string;
    text?: string;
    text_si?: string | null;
    correct?: boolean;
    exp?: string | null;
    exp_si?: string | null;
  }[];
}

export interface ImportPaperResult {
  subjectId: number | null;
  subjectName: string | null;
  examId: number;
  examTitle: string;
  paperId: number;
  paperTitle: string;
  questionsImported: number;
  optionsImported: number;
  totalMarks: number;
  replacedExisting: boolean;
  warnings: string[];
}

// --- PDF extraction -------------------------------------------------------

export type ExtractionStatus = "RUNNING" | "DONE" | "FAILED";

/** A draft question as extraction produces it — the importer shape plus review metadata. */
export interface DraftQuestion {
  number: number;
  stem: string;
  stem_si: string | null;
  type: string;
  /** Provenance line shown under the stem, e.g. which PDF it came from. */
  note?: string | null;
  note_si?: string | null;
  /** Why the answer is what it is — the discussion the whole app exists for. */
  exp?: string | null;
  exp_si?: string | null;
  image?: string | null;
  options: {
    /**
     * Set when editing an already-published paper. Sending it back lets the
     * server update that row rather than replace it, which keeps the recorded
     * answers pointing at it intact. Absent for a freshly extracted draft.
     */
    id?: number;
    L: string;
    text: string;
    text_si: string | null;
    image?: string | null;
    correct: boolean;
    /** Per-option reasoning. For a true/false question this is what a student reads. */
    exp?: string | null;
    exp_si?: string | null;
  }[];
  confidence?: string;
  optionsAreFigures?: boolean;
  truncated?: boolean;
  sourcePage?: number | null;
}

export interface ExtractedAnswer {
  number: number;
  answers: string[];
  exp: string | null;
  exp_si: string | null;
  confidence?: string;
}

export interface ExtractionJob {
  jobId: string;
  status: ExtractionStatus;
  fileName: string;
  message: string;
  pagesTotal: number;
  pagesDone: number;
  model: string;
  mock: boolean;
  pageImages: string[];
  questions: DraftQuestion[];
  /** Set instead of `questions` when the upload was a marking scheme. */
  answers: ExtractedAnswer[] | null;
  errors: string[];
  warnings: string[];
  needsReview: number[];
}
