import { InputError, parseFilters } from "../../../lib/input.ts";
import { searchWorkspaces } from "../../../server/catalog.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const filters = parseFilters(new URL(request.url).searchParams);
    return Response.json({ workspaces: searchWorkspaces(filters), task: filters.task ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof InputError ? error.message : "Results temporarily unavailable." }, { status: error instanceof InputError ? 400 : 503 });
  }
}