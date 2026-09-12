import { configStatus } from "@/lib/env";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/health — sólo dice si la configuración existe; nunca revela valores. */
export function GET() {
  return json({ ok: true, app: "miguel-cpp-lab", config: configStatus() });
}
