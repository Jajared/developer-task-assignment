import type {
  CreateTaskInput,
  DeveloperListResponse,
  ErrorResponse,
  SkillListResponse,
  TaskListResponse,
  TaskResponse,
  UpdateTaskInput,
  UpdateTaskStatusInput,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * A non-2xx response. Carries the status and the server's `{ error, details }`
 * body so callers can show the real message — a 409 from the assignment rule
 * lists the skills the developer is missing under `details.missingSkills`.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(
    status: number,
    body: Partial<ErrorResponse> | null,
    fallback: string,
  ) {
    super(body?.error ?? fallback);
    this.name = "ApiError";
    this.status = status;
    this.details = body?.details;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? "GET";
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
    // Task data is mutable, so never serve it from the build cache.
    cache: "no-store",
  });

  if (!res.ok) {
    const body = (await res
      .json()
      .catch(() => null)) as Partial<ErrorResponse> | null;
    throw new ApiError(
      res.status,
      body,
      `${method} ${path} failed: ${res.status}`,
    );
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export function listTasks() {
  return apiFetch<TaskListResponse>("/api/tasks");
}

export function listDevelopers() {
  return apiFetch<DeveloperListResponse>("/api/developers");
}

export function listSkills() {
  return apiFetch<SkillListResponse>("/api/skills");
}

export function createTask(input: CreateTaskInput) {
  return apiFetch<TaskResponse>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTask(id: string, input: UpdateTaskInput) {
  return apiFetch<TaskResponse>(`/api/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function updateTaskStatus(id: string, input: UpdateTaskStatusInput) {
  return apiFetch<TaskResponse>(`/api/tasks/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
