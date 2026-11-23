import { InputError, parseId } from "../../../../../lib/input.ts";
import { dayTypes, timePeriods } from "../../../../../lib/noise.ts";
import { NoiseEstimationService } from "../../../../../server/noise-estimation.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseQuery(params: URLSearchParams) {
  for (const key of params.keys()) {
    if (!["dayType", "timePeriod"].includes(key) || params.getAll(key).length !== 1) {
      throw new InputError("Invalid query parameters.");
    }
  }
  const dayType = params.get("dayType") ?? "Weekday";
  const timePeriod = params.get("timePeriod") ?? "Morning";
  const day = dayTypes.find(value => value === dayType);
  const period = timePeriods.find(value => value === timePeriod);
  if (!day || !period) throw new InputError("Invalid query parameters.");
  return { dayType: day, timePeriod: period };
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };
  try {
    const workspaceId = parseId((await context.params).id);
    const { dayType, timePeriod } = parseQuery(new URL(request.url).searchParams);
    const result = new NoiseEstimationService().estimate(workspaceId, dayType, timePeriod);
    return result
      ? Response.json(result, { headers })
      : Response.json({ error: "Workspace not found." }, { status: 404, headers });
  } catch (error) {
    // Server-side only: operators see the failure; the client still gets a generic message (FR-16 / NFR-12).
    if (!(error instanceof InputError)) console.error("[GET /api/workspaces/[id]/noise-estimate] catalog unavailable:", error instanceof Error ? error.message : String(error));
    return Response.json({ error: error instanceof InputError ? "Invalid request parameters." : "Results temporarily unavailable." }, {
      status: error instanceof InputError ? 400 : 503, headers,
    });
  }
}