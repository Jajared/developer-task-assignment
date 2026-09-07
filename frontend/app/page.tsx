import { BacklogHeading } from "@/app/_components/backlog-heading";
import { TaskManager } from "@/app/_components/task-manager";
import { DEVELOPERS, SKILLS, TASKS } from "@/lib/mock-data";

/**
 * Server component. Seeds the client shell from in-memory fixtures for now;
 * once the backend is wired up, `listTasks()` from `lib/api.ts` goes here.
 */
export default function Home() {
  return (
    <TaskManager
      initialTasks={TASKS}
      developers={DEVELOPERS}
      initialSkills={SKILLS}
      heading={<BacklogHeading />}
    />
  );
}
