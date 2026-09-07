import type {
  CreateTaskInput,
  TaskListResponse,
  TaskResponse,
  UpdateTaskInput,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
    // Task data is mutable, so never serve it from the build cache.
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${res.status}`);
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export function listTasks() {
  return apiFetch<TaskListResponse>("/api/tasks");
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

export function deleteTask(id: string) {
  return apiFetch<void>(`/api/tasks/${id}`, { method: "DELETE" });
}
