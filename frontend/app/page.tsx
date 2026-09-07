import { TaskStatus, type Task } from "@/lib/types";

import { listTasks } from "@/lib/api";

const STATUS_LABEL: Record<TaskStatus, string> = {
  [TaskStatus.Todo]: "To do",
  [TaskStatus.InProgress]: "In progress",
  [TaskStatus.Done]: "Done",
};

const STATUS_STYLE: Record<TaskStatus, string> = {
  [TaskStatus.Todo]: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  [TaskStatus.InProgress]: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  [TaskStatus.Done]: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

async function loadTasks(): Promise<{ tasks: Task[]; error: string | null }> {
  try {
    const { tasks } = await listTasks();
    return { tasks, error: null };
  } catch (err) {
    return { tasks: [], error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export default async function Home() {
  const { tasks, error } = await loadTasks();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-1 flex-col gap-8 px-8 py-20">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-zinc-500">
            Served by the Express API at <code className="font-mono">{apiUrl}</code>
          </p>
        </header>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            <p className="font-medium">Could not reach the API.</p>
            <p className="mt-1 font-mono text-xs">{error}</p>
            <p className="mt-2">
              Start both apps from the repo root with <code className="font-mono">bun dev</code>.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <span className={task.status === TaskStatus.Done ? "text-zinc-400" : ""}>
                  {task.title}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-zinc-500">{task.assignee ?? "unassigned"}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[task.status]}`}
                  >
                    {STATUS_LABEL[task.status]}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
