/**
 * HOME_PAGE
 *
 * Purpose: Presents the initial public entry point and current foundation status clearly.
 * Connections: App Router and the repository-standard shadcn button primitive.
 * Risk: Low because this route currently renders static public presentation content.
 */
import { Button } from "@/components/ui/button";

const foundationItems = [
  {
    title: "Gia phả có cấu trúc",
    description:
      "Con người và quan hệ huyết thống sẽ được quản lý bằng mô hình dữ liệu rõ ràng, không phụ thuộc vào cách cây đang được vẽ.",
  },
  {
    title: "Quyền riêng tư mặc định",
    description:
      "Dữ liệu người còn sống được thiết kế với nguyên tắc hạn chế công khai và kiểm soát quyền truy cập từ phía máy chủ.",
  },
  {
    title: "Nền tảng có kiểm chứng",
    description:
      "Kiến trúc, kiểm thử và migration được chuẩn hóa để dữ liệu gia phả có thể phát triển lâu dài mà không mất tính toàn vẹn.",
  },
] as const;

export default function HomePage() {
  return (
    <main className="min-h-svh bg-background">
      <section className="mx-auto flex min-h-[72svh] max-w-6xl flex-col justify-center px-6 py-20 lg:px-8">
        <div className="max-w-4xl">
          <p className="mb-6 inline-flex rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
            Nền tảng gia phả số
          </p>
          <h1 className="font-display text-5xl leading-[0.98] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Gia phả họ Nguyễn Làng Khô
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Một nền tảng web để lưu giữ con người, quan hệ và lịch sử dòng họ
            theo cách có cấu trúc, an toàn và có thể kiểm chứng.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href="#nen-tang">Xem nền tảng</a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="https://github.com/hyu276/GiaPhaHoNguyenLangKho">
                Xem mã nguồn
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section
        id="nen-tang"
        aria-labelledby="foundation-heading"
        className="border-t border-border bg-card"
      >
        <div className="mx-auto max-w-6xl px-6 py-16 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary">
              Foundation v0.1
            </p>
            <h2
              id="foundation-heading"
              className="font-display mt-2 text-4xl tracking-tight text-card-foreground"
            >
              Xây đúng nền trước khi xây cây
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {foundationItems.map((item) => (
              <article
                key={item.title}
                className="rounded-3xl border border-border bg-background p-6"
              >
                <h3 className="text-lg font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
