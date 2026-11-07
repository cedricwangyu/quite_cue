export const categories = ["Library", "Café", "Coworking Space", "Campus Study Area", "Other"] as const;
export const noiseLevels = ["Quiet", "Moderate", "Lively"] as const;
export const costBands = ["Free", "Low", "Medium", "High"] as const;
export const tasks = ["Quiet Study", "Group Discussion", "Remote Work"] as const;
export const collectionMethods = ["Field Observation", "Online Source", "Both"] as const;
export type Task = typeof tasks[number];
export type Availability = 0 | 1 | null;
export interface Workspace {
  id: number;
  name: string;
  category: typeof categories[number];
  area: string;
  address: string;
  description: string | null;
  noise_level: typeof noiseLevels[number] | null;
  wifi: Availability;
  outlets: Availability;
  group_friendly: Availability;
  cost_band: typeof costBands[number] | null;
  opening_hours: string | null;
  collection_method: typeof collectionMethods[number] | null;
  source_note: string | null;
  observation_ref: string | null;
  source_url: string | null;
  last_verified_date: string | null;
  published: 0 | 1;
  is_demo: 0 | 1;
}
export interface Filters {
  search: string;
  category?: Workspace["category"];
  noise?: NonNullable<Workspace["noise_level"]>;
  cost?: NonNullable<Workspace["cost_band"]>;
  wifi?: true;
  outlets?: true;
  group?: true;
  task?: Task;
}
export interface RankedWorkspace extends Workspace {
  score: number | null;
  max_score: number | null;
  explanation: string | null;
}
export function availabilityLabel(value: Availability): string {
  return value === 1 ? "Available" : value === 0 ? "Not available" : "Unknown";
}