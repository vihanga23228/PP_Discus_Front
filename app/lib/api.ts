import type {
  AdminStats,
  AdminUser,
  AnswerSubmission,
  AuthResponse,
  Exam,
  ImportPaperResult,
  ImportQuestion,
  Paged,
  ExtractionJob,
  Paper,
  Question,
  Subject,
  QuizAttemptSummary,
  StartQuizResponse,
} from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8083";

export const TOKEN_KEY = "epe.token";
export const USER_KEY = "epe.user";

/** An API call that came back with a non-2xx status. */
export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;

  constructor(message: string, status: number, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Attach the stored bearer token. Defaults to true. */
  auth?: boolean;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, signal } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth) {
    const token = readToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError(
      `Could not reach the server at ${BASE_URL}. Is the Spring Boot backend running?`,
      0,
    );
  }

  if (response.status === 204) return undefined as T;

  const raw = await response.text();
  const payload = raw ? safeJson(raw) : null;

  if (!response.ok) {
    const message =
      (payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message: unknown }).message)
        : null) ?? fallbackMessage(response.status);

    const fieldErrors =
      payload && typeof payload === "object" && "fieldErrors" in payload
        ? ((payload as { fieldErrors: Record<string, string> }).fieldErrors)
        : undefined;

    throw new ApiError(message, response.status, fieldErrors);
  }

  return payload as T;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return { message: raw };
  }
}

function fallbackMessage(status: number): string {
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to do that.";
  if (status === 404) return "We could not find what you were looking for.";
  return `Request failed (${status}).`;
}

export const api = {
  // --- auth ---
  register: (body: { username: string; email: string; password: string }) =>
    request<AuthResponse>("/api/auth/register", { method: "POST", body, auth: false }),

  login: (body: { username: string; password: string }) =>
    request<AuthResponse>("/api/auth/login", { method: "POST", body, auth: false }),

  loginWithGoogle: (idToken: string) =>
    request<AuthResponse>("/api/auth/google", {
      method: "POST",
      body: { idToken },
      auth: false,
    }),

  me: (signal?: AbortSignal) => request<AuthResponse>("/api/auth/me", { signal }),

  providers: (signal?: AbortSignal) =>
    request<{ google: boolean }>("/api/auth/providers", { auth: false, signal }),

  // --- catalogue (public): Subject -> Exam -> Paper ---
  subjects: (signal?: AbortSignal) =>
    request<Subject[]>("/api/subjects", { auth: false, signal }),

  subject: (subjectId: number, signal?: AbortSignal) =>
    request<Subject>(`/api/subjects/${subjectId}`, { auth: false, signal }),

  examsBySubject: (subjectId: number, signal?: AbortSignal) =>
    request<Exam[]>(`/api/subjects/${subjectId}/exams`, { auth: false, signal }),

  exams: (signal?: AbortSignal) => request<Exam[]>("/api/exams", { auth: false, signal }),

  exam: (examId: number, signal?: AbortSignal) =>
    request<Exam>(`/api/exams/${examId}`, { auth: false, signal }),

  papers: (examId: number, signal?: AbortSignal) =>
    request<Paper[]>(`/api/exams/${examId}/papers`, { auth: false, signal }),

  paper: (examId: number, paperId: number, signal?: AbortSignal) =>
    request<Paper>(`/api/exams/${examId}/papers/${paperId}`, { auth: false, signal }),

  // --- questions & quiz (require a signed-in user) ---
  questionsByPaper: (paperId: number, signal?: AbortSignal) =>
    request<Question[]>(`/api/questions?paperId=${paperId}`, { signal }),

  startQuiz: (paperId: number) =>
    request<StartQuizResponse>("/api/quiz/start", { method: "POST", body: { paperId } }),

  submitQuiz: (attemptId: number, answers: AnswerSubmission[]) =>
    request<QuizAttemptSummary>(`/api/quiz/${attemptId}/submit`, {
      method: "POST",
      body: { answers },
    }),

  attempts: (signal?: AbortSignal) =>
    request<QuizAttemptSummary[]>("/api/quiz/attempts", { signal }),

  // --- admin (ROLE_ADMIN only) ---
  admin: {
    stats: (signal?: AbortSignal) => request<AdminStats>("/api/admin/stats", { signal }),

    users: (params: { search?: string; page?: number; size?: number }, signal?: AbortSignal) => {
      const query = new URLSearchParams();
      if (params.search) query.set("search", params.search);
      query.set("page", String(params.page ?? 0));
      query.set("size", String(params.size ?? 20));
      return request<Paged<AdminUser>>(`/api/admin/users?${query}`, { signal });
    },

    updateUser: (id: number, body: { role?: string; enabled?: boolean }) =>
      request<AdminUser>(`/api/admin/users/${id}`, { method: "PUT", body }),

    deleteUser: (id: number) =>
      request<void>(`/api/admin/users/${id}`, { method: "DELETE" }),

    importPaper: (body: {
      subjectId?: number;
      newSubjectName?: string;
      newSubjectDescription?: string;
      examId?: number;
      newExamTitle?: string;
      newExamDescription?: string;
      title: string;
      description?: string;
      year?: number;
      replaceExisting: boolean;
      questions: ImportQuestion[];
    }) => request<ImportPaperResult>("/api/admin/papers/import", { method: "POST", body }),

    // --- PDF extraction ---
    importCapabilities: (signal?: AbortSignal) =>
      request<{ vision: boolean }>("/api/admin/import/capabilities", { signal }),

    /** Uploads the PDF and returns the id of the background extraction job. */
    extractPdf: async (file: File, mock: boolean) => {
      const form = new FormData();
      form.append("file", file);

      const token = readToken();
      const response = await fetch(
        `${BASE_URL}/api/admin/papers/extract?mock=${mock}`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        },
      );

      const payload = (await response.json().catch(() => null)) as { message?: string; jobId?: string } | null;
      if (!response.ok) {
        throw new ApiError(payload?.message ?? "The upload failed.", response.status);
      }
      return { jobId: payload?.jobId ?? "" };
    },

    extractionStatus: (jobId: string, signal?: AbortSignal) =>
      request<ExtractionJob>(`/api/admin/papers/extract/${jobId}`, { signal }),

    /** keepFigures=true after publishing, so the cropped figures the new questions
     *  reference are not deleted along with the page renders. */
    discardExtraction: (jobId: string, keepFigures = false) =>
      request<void>(
        `/api/admin/papers/extract/${jobId}?keepFigures=${keepFigures}`,
        { method: "DELETE" },
      ),

    // --- catalogue editing: rename, move, or remove at any level ---
    createSubject: (body: { name: string; description?: string }) =>
      request<Subject>("/api/subjects", { method: "POST", body }),

    updateSubject: (id: number, body: { name: string; description?: string }) =>
      request<Subject>(`/api/subjects/${id}`, { method: "PUT", body }),

    deleteSubject: (id: number) =>
      request<void>(`/api/subjects/${id}`, { method: "DELETE" }),

    createExam: (body: { title: string; description?: string; subjectId: number }) =>
      request<Exam>("/api/exams", { method: "POST", body }),

    updateExam: (id: number, body: { title: string; description?: string; subjectId?: number }) =>
      request<Exam>(`/api/exams/${id}`, { method: "PUT", body }),

    deleteExam: (id: number) => request<void>(`/api/exams/${id}`, { method: "DELETE" }),

    createPaper: (
      examId: number,
      body: { title: string; description?: string; year?: number; durationMinutes?: number },
    ) => request<Paper>(`/api/exams/${examId}/papers`, { method: "POST", body }),

    updatePaper: (
      examId: number,
      paperId: number,
      body: { title: string; description?: string; year?: number; durationMinutes?: number },
    ) => request<Paper>(`/api/exams/${examId}/papers/${paperId}`, { method: "PUT", body }),

    deletePaper: (examId: number, paperId: number) =>
      request<void>(`/api/exams/${examId}/papers/${paperId}`, { method: "DELETE" }),
  },
};
