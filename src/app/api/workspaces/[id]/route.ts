import { InputError, parseId } from "../../../../lib/input.ts";
import { getWorkspace } from "../../../../server/catalog.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const workspace = getWorkspace(parseId((await context.params).id));
    return workspace ? Response.json({ workspace }, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "Workspace not found." }, { status: 404 });
  } catch (error) {
    return Response.json({ error: error instanceof InputError ? error.message : "Results temporarily unavailable." }, { status: error instanceof InputError ? 400 : 503 });
  }
}