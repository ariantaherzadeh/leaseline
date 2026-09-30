import { getTeamView, NotFound } from "@/lib/conversation";

export async function GET(_req: Request, ctx: RouteContext<"/api/conversations/[id]">) {
  const { id } = await ctx.params;
  try {
    return Response.json(await getTeamView(id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof NotFound) {
      return Response.json({ error: "No call with that id for this assistant." }, { status: 404 });
    }
    console.error(error);
    return Response.json({ error: "Couldn't load the call. Try again shortly." }, { status: 502 });
  }
}
