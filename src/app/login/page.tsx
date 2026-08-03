import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/login-form";
import { getSafeInternalRedirect } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string | string[];
    message?: string | string[];
  }>;
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const requestedPath = Array.isArray(params.next) ? params.next[0] : params.next;
  const message = Array.isArray(params.message)
    ? params.message[0]
    : params.message;
  const destination = getSafeInternalRedirect(requestedPath);
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(destination);
  }

  return <LoginForm destination={destination} message={message} />;
}
