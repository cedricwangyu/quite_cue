import { categories, costBands, noiseLevels, tasks, type Filters } from "./model.ts";

export class InputError extends Error {}

function enumValue<const Values extends readonly string[]>(params: URLSearchParams, key: string, values: Values): Values[number] | undefined {
  const value = params.get(key);
  if (value === null) return undefined;
  if (!values.includes(value)) throw new InputError(`Invalid ${key}.`);
  return value;
}

export function parseFilters(params: URLSearchParams): Filters {
  const allowed = ["search", "category", "noise", "cost", "wifi", "outlets", "group", "task"];
  for (const key of params.keys()) {
    if (!allowed.includes(key) || params.getAll(key).length !== 1) throw new InputError("Invalid query parameters.");
  }
  const rawSearch = params.get("search") ?? "";
  if (rawSearch.length > 100) throw new InputError("Search must be 100 characters or fewer.");
  if (/[\u0000-\u001f\u007f]/u.test(rawSearch)) throw new InputError("Search contains invalid characters.");
  const filters: Filters = {
    search: rawSearch.trim(),
    category: enumValue(params, "category", categories),
    noise: enumValue(params, "noise", noiseLevels),
    cost: enumValue(params, "cost", costBands),
    task: enumValue(params, "task", tasks),
  };
  for (const key of ["wifi", "outlets", "group"] as const) {
    if (params.has(key)) {
      if (params.get(key) !== "true") throw new InputError(`Invalid ${key}.`);
      filters[key] = true;
    }
  }
  return filters;
}

export function parseId(value: string): number {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new InputError("Invalid workspace ID.");
  return Number(value);
}