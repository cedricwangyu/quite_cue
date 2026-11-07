import { withDatabase } from "../src/server/database.ts";
import { validateRealRecord } from "../src/server/data-validation.ts";
import type { Workspace } from "../src/lib/model.ts";

withDatabase(database => {
  const records = database.prepare("SELECT * FROM workspaces WHERE published = 1 AND is_demo = 0").all() as unknown as Workspace[];
  for (const record of records) validateRealRecord(record);
  const fields = ["noise_level", "wifi", "outlets", "group_friendly", "cost_band"] as const;
  const known = records.reduce((total, record) => total + fields.filter(field => record[field] !== null).length, 0);
  console.log(JSON.stringify({ validatedPublicRealRecords: records.length, categories: new Set(records.map(record => record.category)).size,
    environmentFieldCoverage: records.length ? known / (records.length * fields.length) : 0,
    note: "Demo excluded. Coverage measures five environment fields; confirm the SRS definition before formal acceptance. Evidence authenticity requires human review." }, null, 2));
});