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
    <main className="min-h-svh bg-background p-3 sm:p-5 lg:p-7">
      <div className="mx-auto grid min-h-[calc(100svh-1.5rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm sm:min-h-[calc(100svh-2.5rem)] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden bg-foreground px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div
            aria-hidden="true"
            className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/35 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-secondary/20 blur-3xl"
          />

          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Gia phả họ Nguyễn Làng Khô
            </p>
            <h1 className="font-display mt-5 max-w-lg text-6xl leading-[0.95] tracking-tight">
              Gìn giữ ký ức gia đình trong một không gian riêng tư.
            </h1>
            <p className="mt-6 max-w-md text-sm leading-7 text-zinc-300">
              Sơ đồ gia phả, hồ sơ thành viên và nguồn tư liệu được quản lý tập
              trung, có lịch sử thay đổi và kiểm soát quyền truy cập.
            </p>
          </div>

          <div className="relative grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-sm font-semibold">Quản trị viên</p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">
                Cập nhật hồ sơ, quan hệ, bố cục và nguồn tư liệu.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-sm font-semibold">Người xem</p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">
                Xem gia phả mà không thể thay đổi dữ liệu.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-12">
          <div className="w-full max-w-md">
            <div className="lg:hidden">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Gia phả họ Nguyễn Làng Khô
              </p>
            </div>

            <p className="mt-2 text-sm font-semibold text-primary lg:mt-0">
              Khu vực gia đình
            </p>
            <h2 className="font-display mt-2 text-4xl tracking-tight text-card-foreground sm:text-5xl">
              Đăng nhập
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Sử dụng tài khoản đã được người quản trị gia phả cấp quyền.
            </p>

            {message ? (
              <p
                role="alert"
                className="mt-6 rounded-2xl border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive"
              >
                {message}
              </p>
            ) : null}

            <form action={signIn} className="mt-8 space-y-5">
              <div className="space-y-2">
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
                  placeholder="tenban@example.com"
                  className="h-12 w-full rounded-2xl border border-input bg-background px-4 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
                />
              </div>

              <div className="space-y-2">
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
                  className="h-12 w-full rounded-2xl border border-input bg-background px-4 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="h-12 w-full rounded-2xl"
              >
                Vào gia phả
              </Button>
            </form>

            <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
              Dữ liệu gia phả là thông tin nội bộ. Không chia sẻ tài khoản cho
              người không được cấp quyền.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
