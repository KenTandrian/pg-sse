import { pgListener } from "@/lib/pg-listener";
import { createSseHandler } from "pg-sse/server";

export async function GET(req: Request) {
  return createSseHandler(pgListener, req);
}
