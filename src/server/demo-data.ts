import type { Workspace } from "../lib/model.ts";

const base: Workspace = {
  id: 1, name: "", category: "Library", area: "North Quarter", address: "", description: "Fictional workspace for course demonstration. No real venue observations are represented.",
  noise_level: null, wifi: null, outlets: null, group_friendly: null, cost_band: null, opening_hours: null,
  collection_method: null, source_note: "Synthetic Demo Data; not collected or verified at a real location.", observation_ref: null, source_url: null, last_verified_date: null, published: 1, is_demo: 1,
};
const entries: Partial<Workspace>[] = [
  { name: "Willow Reading Library", category: "Library", noise_level: "Quiet", wifi: 1, outlets: 1, group_friendly: 0, cost_band: "Free" },
  { name: "Juniper Commons", category: "Campus Study Area", noise_level: "Moderate", wifi: 1, outlets: 1, group_friendly: 1, cost_band: "Free", area: "Campus District" },
  { name: "Paperplane Café", category: "Café", noise_level: "Lively", wifi: 1, outlets: 0, group_friendly: 1, cost_band: "Low", area: "East Quarter" },
  { name: "Northlight Workrooms", category: "Coworking Space", noise_level: "Quiet", wifi: 1, outlets: 1, group_friendly: 1, cost_band: "High" },
  { name: "Fern Study Hall", category: "Campus Study Area", noise_level: "Quiet", wifi: 1, outlets: 0, group_friendly: 0, cost_band: "Free", area: "Campus District" },
  { name: "Copper Kettle Café", category: "Café", noise_level: "Moderate", wifi: null, outlets: 1, group_friendly: 1, cost_band: "Low", area: "East Quarter" },
  { name: "Mosaic Community Room", category: "Other", noise_level: "Lively", wifi: 0, outlets: 1, group_friendly: 1, cost_band: "Free", area: "West Quarter" },
  { name: "Atlas Shared Studio", category: "Coworking Space", noise_level: "Moderate", wifi: 1, outlets: 1, group_friendly: 1, cost_band: "Medium", area: "West Quarter" },
  { name: "Elm Pocket Library", category: "Library", noise_level: "Quiet", wifi: 0, outlets: null, group_friendly: 0, cost_band: "Free", area: "East Quarter" },
  { name: "Cloudberry Lounge", category: "Other", area: "South Quarter" },
  { name: "Birch Courtyard", category: "Campus Study Area", noise_level: "Moderate", wifi: null, outlets: 0, group_friendly: 1, cost_band: "Free", area: "Campus District" },
  { name: "Unpublished Demo Room", published: 0, area: "Private District" },
];
export const demoData: Workspace[] = entries.map((entry, index) => ({ ...base, ...entry, id: index + 1, address: `${index + 1} Fictional Lane, ${entry.area ?? base.area}` }));