/**
 * ADMIN_LOGIN_PAGE
 *
 * Purpose: Provides the polished authenticated entry point for genealogy administrators and read-only family viewers.
 * Connections: Supabase password authentication and the authenticated genealogy workspace.
 * Risk: Medium because login errors and role checks gate all internal access.
 */
import { redirect } from "next/navigation";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const errorMessages = {
  forbidden: "Tài khoản này chưa được cấp quyền truy cập gia phả.",
  invalid: "Email hoặc mật khẩu không đúng.",
} as const;

type TreeViewerRole = "admin" | "spectator";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

function getTreeViewerRole(value: unknown): TreeViewerRole | null {
  return value === "admin" || value === "spectator" ? value : null;
}

async function signIn(formData: FormData) {
  "use server";

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect("/admin/login?error=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    redirect("/admin/login?error=invalid");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!getTreeViewerRole(user?.app_metadata.role)) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=forbidden");
  }

  redirect("/admin/tree");
}

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  const message =
    error === "forbidden"
      ? errorMessages.forbidden
      : error === "invalid"
        ? errorMessages.invalid
        : null;

  return (
    <main className="min-h-svh bg-background px-5 py-10 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-5rem)] max-w-md flex-col justify-center">
        <header className="mb-10 border-b border-border pb-5">
          <p className="text-sm font-medium text-primary">
            Gia phả họ Nguyễn Làng Khô
          </p>
          <h1 className="font-display mt-2 text-3xl tracking-tight text-card-foreground sm:text-4xl">
            Khu vực gia đình
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Chỉ dành cho thành viên đã được cấp quyền truy cập.
          </p>
        </header>

        <section aria-labelledby="login-heading">
          <h2
            className="text-lg font-semibold text-card-foreground"
            id="login-heading"
          >
            Đăng nhập
          </h2>

          {message ? (
            <p
              role="alert"
              className="mt-4 border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {message}
            </p>
          ) : null}

          <form action={signIn} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-sm font-medium text-foreground"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium text-foreground"
              >
                Mật khẩu
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
              />
            </div>

            <Button className="h-11 w-full rounded-md" size="lg" type="submit">
              Vào gia phả
            </Button>
          </form>

          <p className="mt-5 text-xs leading-5 text-muted-foreground">
            Nếu không đăng nhập được, hãy liên hệ người quản trị gia phả thay vì
            tạo tài khoản mới.
          </p>
        </section>
      </div>
    </main>
   );
}
