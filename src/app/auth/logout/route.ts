import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut({ scope: "local" });

  const response = NextResponse.redirect(
    new URL("/login?message=signed-out", request.url),
    303,
  );
  response.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate",
  );
  response.headers.set("Clear-Site-Data", '"cache"');
  return response;
}
