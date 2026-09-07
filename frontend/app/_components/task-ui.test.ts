import { describe, expect, test } from "bun:test";

import { TaskStatus, type Developer, type Skill, type Task } from "@/types";

import {
  ancestorsOf,
  childrenOf,
  eligibleDevelopers,
  flattenTree,
  hasAllSkills,
  hasUnfinishedSubtasks,
  missingSkills,
} from "./task-ui";

/**
 * The pure helpers that turn the API's flat task list into a tree and mirror
 * the server's rules client-side. No DOM, no network: `bun test` from this
 * directory (or `bun run test` at the root).
 */

const at = "2026-09-07T00:00:00.000Z";

const skill = (name: string): Skill => ({ id: `skill-${name}`, name, createdAt: at, updatedAt: at });
const frontend = skill("Frontend");
const backend = skill("Backend");

const developer = (name: string, skills: Skill[]): Developer => ({
  id: `dev-${name}`,
  name,
  createdAt: at,
  updatedAt: at,
  skills,
});

const task = (
  id: string,
  parentId: string | null = null,
  status: TaskStatus = TaskStatus.Todo,
): Task => ({
  id,
  title: id,
  description: null,
  status,
  assigneeId: null,
  parentId,
  createdAt: at,
  updatedAt: at,
  assignee: null,
  requiredSkills: [],
});

// root
// ├── a
// │   ├── a1
// │   └── a2
// │       └── a2x
// └── b
// other (a second root)
const tree = [
  task("root"),
  task("a", "root"),
  task("a1", "a", TaskStatus.Done),
  task("a2", "a"),
  task("a2x", "a2"),
  task("b", "root", TaskStatus.Done),
  task("other"),
];

const ids = (rows: { task: Task }[]) => rows.map((r) => r.task.id);

describe("flattenTree", () => {
  test("collapsed by default: only roots, each reporting its direct child count", () => {
    const rows = flattenTree(tree, new Set());
    expect(ids(rows)).toEqual(["root", "other"]);
    expect(rows.map((r) => r.childCount)).toEqual([2, 0]);
    expect(rows.every((r) => r.depth === 0)).toBe(true);
  });

  test("expanding a task reveals its direct subtasks, depth-first, one level deeper", () => {
    const rows = flattenTree(tree, new Set(["root"]));
    expect(ids(rows)).toEqual(["root", "a", "b", "other"]);
    expect(rows.find((r) => r.task.id === "a")?.depth).toBe(1);
    // "a" is collapsed, so its children stay hidden but are counted.
    expect(rows.find((r) => r.task.id === "a")?.childCount).toBe(2);
  });

  test("nested expansion goes as deep as the expanded set allows", () => {
    const rows = flattenTree(tree, new Set(["root", "a", "a2"]));
    expect(ids(rows)).toEqual(["root", "a", "a1", "a2", "a2x", "b", "other"]);
    expect(rows.find((r) => r.task.id === "a2x")?.depth).toBe(3);
  });

  test("expanding a child whose parent is collapsed shows nothing extra", () => {
    expect(ids(flattenTree(tree, new Set(["a"])))).toEqual(["root", "other"]);
  });

  test("a subtask whose parent was filtered out is shown as a root", () => {
    // e.g. the Done filter kept a1 and b but dropped their parents.
    const filtered = tree.filter((t) => t.status === TaskStatus.Done);
    const rows = flattenTree(filtered, new Set());
    expect(ids(rows)).toEqual(["a1", "b"]);
    expect(rows.every((r) => r.depth === 0)).toBe(true);
  });

  test("preserves the input order among siblings", () => {
    const reversed = [...tree].reverse();
    expect(ids(flattenTree(reversed, new Set(["root"])))).toEqual(["other", "root", "b", "a"]);
  });

  test("an empty list is an empty tree", () => {
    expect(flattenTree([], new Set(["root"]))).toEqual([]);
  });
});

describe("childrenOf", () => {
  test("returns only direct subtasks, in list order", () => {
    expect(childrenOf(tree, "root").map((t) => t.id)).toEqual(["a", "b"]);
    expect(childrenOf(tree, "a").map((t) => t.id)).toEqual(["a1", "a2"]);
  });

  test("is empty for a leaf or an unknown id", () => {
    expect(childrenOf(tree, "a2x")).toEqual([]);
    expect(childrenOf(tree, "nope")).toEqual([]);
  });
});

describe("hasUnfinishedSubtasks (mirrors the server's completion rule)", () => {
  test("true while any direct subtask is not done", () => {
    expect(hasUnfinishedSubtasks(task("root"), tree)).toBe(true); // "a" is todo
    expect(hasUnfinishedSubtasks(task("a"), tree)).toBe(true); // "a2" is todo
  });

  test("false when every direct subtask is done, or there are none", () => {
    const allDone = [task("p"), task("c1", "p", TaskStatus.Done), task("c2", "p", TaskStatus.Done)];
    expect(hasUnfinishedSubtasks(task("p"), allDone)).toBe(false);
    expect(hasUnfinishedSubtasks(task("a2x"), tree)).toBe(false);
  });

  test("judges direct children only — a done child vouches for its own subtree", () => {
    // p → c (done) → g (todo): p is completable, c is not.
    const list = [task("p"), task("c", "p", TaskStatus.Done), task("g", "c")];
    expect(hasUnfinishedSubtasks(task("p"), list)).toBe(false);
    expect(hasUnfinishedSubtasks(task("c"), list)).toBe(true);
  });

});

describe("ancestorsOf", () => {
  test("lists every ancestor, nearest first", () => {
    expect(ancestorsOf(tree, "a2x")).toEqual(["a2", "a", "root"]);
    expect(ancestorsOf(tree, "a")).toEqual(["root"]);
  });

  test("is empty for a root or an unknown id", () => {
    expect(ancestorsOf(tree, "root")).toEqual([]);
    expect(ancestorsOf(tree, "nope")).toEqual([]);
  });

  test("stops at a parent that is not in the list", () => {
    const partial = tree.filter((t) => t.id !== "a");
    expect(ancestorsOf(partial, "a2x")).toEqual(["a2"]);
  });

  test("terminates on a cycle instead of looping forever", () => {
    // Malformed data the API never produces; each id is still reported once.
    const cyclic = [task("x", "y"), task("y", "x")];
    expect(ancestorsOf(cyclic, "x")).toEqual(["y", "x"]);
  });
});

describe("skill matching (mirrors the server's assignment rule)", () => {
  const alice = developer("Alice", [frontend]);
  const carol = developer("Carol", [frontend, backend]);

  test("hasAllSkills requires every required skill", () => {
    expect(hasAllSkills(alice, [frontend])).toBe(true);
    expect(hasAllSkills(alice, [frontend, backend])).toBe(false);
    expect(hasAllSkills(carol, [frontend, backend])).toBe(true);
  });

  test("no required skills means anyone qualifies", () => {
    expect(hasAllSkills(alice, [])).toBe(true);
    expect(eligibleDevelopers([alice, carol], [])).toEqual([alice, carol]);
  });

  test("missingSkills names exactly the skills the developer lacks", () => {
    expect(missingSkills(alice, [frontend, backend])).toEqual([backend]);
    expect(missingSkills(carol, [frontend, backend])).toEqual([]);
  });

  test("eligibleDevelopers keeps only fully qualified developers", () => {
    expect(eligibleDevelopers([alice, carol], [backend])).toEqual([carol]);
    expect(eligibleDevelopers([alice, carol], [frontend])).toEqual([alice, carol]);
  });
});
