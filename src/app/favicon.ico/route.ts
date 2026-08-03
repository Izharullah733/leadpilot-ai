import type { NextRequest } from "next/server";

export function GET(request: NextRequest) {
  return Response.redirect(new URL("/icon.svg", request.url), 307);
}
