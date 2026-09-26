import Image from "next/image";
import { useTranslations } from "next-intl";

import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  const t = useTranslations("auth");
  const tApp = useTranslations("app");

  return (
    <div className="grid min-h-[100dvh] flex-1 lg:grid-cols-[1fr_1.1fr]">
      {/* Brand panel: hidden on small screens, where the logo sits above the form instead. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <span className="text-sm font-medium tracking-tight opacity-90">{tApp("name")}</span>
        <div className="space-y-4">
          <Image
            src="/logo.jpg"
            alt=""
            width={160}
            height={160}
            priority
            className="size-40 rounded-full object-cover ring-4 ring-primary-foreground/20"
          />
          <p className="max-w-sm text-2xl leading-snug font-medium tracking-tight">{t("loginSubtitle")}</p>
        </div>
        <span className="text-xs opacity-70">Unity · Faith · Discipline</span>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-4">
            <Image
              src="/logo.jpg"
              alt=""
              width={56}
              height={56}
              className="size-14 rounded-full object-cover ring-1 ring-border lg:hidden"
            />
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">{t("loginTitle")}</h1>
              <p className="text-sm text-muted-foreground lg:hidden">{t("loginSubtitle")}</p>
            </div>
          </div>
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
