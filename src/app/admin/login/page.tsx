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
    <main className="min-h-svh bg-background">
      <div className="mx-auto grid min-h-svh max-w-5xl lg:grid-cols-[0.95fr_1.05fr]">
        <section className="hidden border-r border-border px-10 py-12 lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">
              Gia phả họ Nguyễn Làng Khô
            </p>
            <h1 className="font-display mt-6 max-w-md text-5xl leading-tight tracking-tight text-card-foreground">
              Kho lưu giữ thông tin và ký ức của gia đình.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">
              Hồ sơ thành viên, quan hệ gia đình và nguồn tư liệu được quản lý
              trong một không gian riêng tư, có phân quyền rõ ràng.
            </p>
          </div>

          <div className="border-t border-border pt-5 text-xs leading-6 text-muted-foreground">
            <p>Quản trị viên có thể cập nhật dữ liệu.</p>
            <p>Người xem chỉ có quyền đọc.</p>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-12 sm:px-10 lg:px-14">
          <div className="w-full max-w-sm">
            <p className="text-sm font-medium text-primary lg:hidden">
              Gia phả họ Nguyễn Làng Khô
            </p>
            <h2 className="font-display mt-2 text-4xl tracking-tight text-card-foreground">
              Đăng nhập
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Dùng tài khoản đã được cấp quyền truy cập.
            </p>

            {message ? (
              <p
                role="alert"
                className="mt-5 border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {message}
              </p>
            ) : null}

            <form action={signIn} className="mt-7 space-y-4">
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
                  placeholder="tenban@example.com"
                  className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
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

              <Button type="submit" size="lg" className="h-11 w-full rounded-md">
                Vào gia phả
              </Button>
            </form>

            <p className="mt-5 text-xs leading-5 text-muted-foreground">
              Đây là khu vực nội bộ. Không chia sẻ tài khoản cho người chưa được
              cấp quyền.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
