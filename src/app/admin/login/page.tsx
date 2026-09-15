import { redirect } from "next/navigation";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const errorMessages = {
  forbidden: "Tài khoản này không có quyền quản trị.",
  invalid: "Email hoặc mật khẩu không hợp lệ.",
} as const;

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

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

  if (user?.app_metadata.role !== "admin") {
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
    <main className="grid min-h-svh place-items-center bg-background px-6 py-12">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-sm">
        <p className="text-sm font-semibold text-primary">Khu vực quản trị</p>
        <h1 className="font-display mt-2 text-4xl tracking-tight text-card-foreground">
          Đăng nhập để chỉnh gia phả
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Chỉ tài khoản được gán quyền admin trong Supabase Auth mới có thể sửa
          dữ liệu và vị trí trên sơ đồ.
        </p>

        {message ? (
          <p
            role="alert"
            className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
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
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
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
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>

          <Button type="submit" size="lg" className="w-full">
            Đăng nhập
          </Button>
        </form>
      </section>
    </main>
  );
}
