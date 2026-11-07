import type { RankedWorkspace, Task, Workspace } from "./model.ts";

export function compareNames(first: Workspace, second: Workspace): number {
  const firstName = first.name.toLowerCase();
  const secondName = second.name.toLowerCase();
  return firstName < secondName ? -1 : firstName > secondName ? 1 : first.id - second.id;
}

export function scoreWorkspace(workspace: Workspace, task: Task): RankedWorkspace {
  let score = 0;
  const reasons: string[] = [];
  const add = (matches: boolean, points: number, reason: string) => {
    if (matches) { score += points; reasons.push(reason); }
  };
  if (task === "Quiet Study") {
    add(workspace.noise_level === "Quiet", 2, "a quiet environment");
    add(workspace.outlets === 1, 1, "power outlets");
    add(workspace.wifi === 1, 1, "Wi-Fi");
  } else if (task === "Group Discussion") {
    add(workspace.group_friendly === 1, 2, "a group-friendly space");
    add(workspace.noise_level === "Moderate" || workspace.noise_level === "Lively", 1, "a moderate or lively environment");
    add(workspace.wifi === 1, 1, "Wi-Fi");
  } else {
    add(workspace.wifi === 1, 2, "Wi-Fi");
    add(workspace.outlets === 1, 2, "power outlets");
    add(workspace.noise_level === "Quiet" || workspace.noise_level === "Moderate", 1, "a quiet or moderate environment");
  }
  const reasonText = reasons.length <= 1 ? reasons.join("") : `${reasons.slice(0, -1).join(", ")} and ${reasons.at(-1)}`;
  return { ...workspace, score, max_score: task === "Remote Work" ? 5 : 4,
    explanation: score === 0 ? "No verified task match." : `Recommended for ${task} because this workspace has ${reasonText}.` };
}

export function rankWorkspaces(workspaces: Workspace[], task?: Task): RankedWorkspace[] {
  if (!task) return workspaces.map(workspace => ({ ...workspace, score: null, max_score: null, explanation: null })).sort(compareNames);
  return workspaces.map(workspace => scoreWorkspace(workspace, task)).sort((first, second) => (second.score ?? 0) - (first.score ?? 0) || compareNames(first, second));
}