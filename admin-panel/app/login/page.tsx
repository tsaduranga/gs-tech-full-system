"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  EyeIcon,
  EyeOffIcon,
  Receipt,
  Sparkles,
  Warehouse,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/api";
import {
  setSessionTokens,
  setStoredUser,
  setStoredPermissions,
  getStoredAccess,
} from "@/lib/auth-storage";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: Boxes, label: "Inventory Control" },
  { icon: Receipt, label: "Sales & Invoicing" },
  { icon: Warehouse, label: "Multi-Warehouse" },
] as const;

const LOGIN_IMAGES: {
  src: string;
  alt: string;
  offset?: boolean;
}[] = [
  {
    src: "/login/inventory.jpg",
    alt: "Warehouse shelves stocked with inventory",
  },
  {
    src: "/login/sales.jpg",
    alt: "Retail checkout and sales transaction",
    offset: true,
  },
  {
    src: "/login/warehouse.jpg",
    alt: "Distribution warehouse operations",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("Admin123!");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getStoredAccess()) router.replace("/dashboard");
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiJson<{
        accessToken: string;
        refreshToken: string;
        user: { id: number; username: string };
        permissions: string[];
      }>("/auth/login", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok || !res.data) {
        setError(res.error ?? "Login failed");
        return;
      }
      setSessionTokens(res.data.accessToken, res.data.refreshToken);
      setStoredUser(res.data.user);
      setStoredPermissions(res.data.permissions ?? []);
      router.replace("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left — sign-in form */}
      <div className="flex w-full flex-col lg:w-[44%] xl:max-w-xl xl:shrink-0">
        <div className="flex flex-1 flex-col justify-center px-8 py-12 sm:px-12 lg:px-14 xl:px-16">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-10">
              <Image
                src="/gs-technology-logo.png"
                alt="GS Technology"
                width={200}
                height={68}
                className="h-auto w-[180px] max-w-full object-contain"
                priority
              />
            </div>

            <div className="mb-8 space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                Sign in
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Access the GS Technology admin portal to manage inventory, sales,
                and daily operations.
              </p>
            </div>

            <form className="flex flex-col gap-5" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium">
                  Username
                </Label>
                <Input
                  id="username"
                  autoComplete="username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-10 bg-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 bg-white pr-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </Button>
                </div>
              </div>

              {error && (
                <p
                  className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="mt-1 h-10 w-full bg-[oklch(0.52_0.14_264)] text-white hover:bg-[oklch(0.46_0.14_264)]"
              >
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </div>
        </div>

        <footer className="border-t border-border/60 px-8 py-5 text-center text-xs text-muted-foreground sm:px-12 lg:px-14">
          <p>Developed By Kalyt Solutions</p>
          <a
            href="tel:+94770604104"
            className="mt-0.5 inline-block text-foreground/70 underline-offset-2 hover:text-foreground hover:underline"
          >
            077 0604104
          </a>
        </footer>
      </div>

      {/* Right — branded panel */}
      <div className="relative hidden flex-1 overflow-hidden bg-[oklch(0.16_0.04_264)] lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          aria-hidden
        >
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-[oklch(0.45_0.16_250)] blur-3xl" />
          <div className="absolute top-1/3 -left-32 h-80 w-80 rounded-full bg-[oklch(0.35_0.12_280)] blur-3xl" />
          <div className="absolute right-0 bottom-0 h-72 w-72 rounded-full bg-[oklch(0.28_0.1_264)] blur-3xl" />
        </div>

        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-30"
          viewBox="0 0 800 600"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M-20 120 Q 200 80 400 200 T 820 100"
            fill="none"
            stroke="oklch(0.55 0.14 250)"
            strokeWidth="1.5"
          />
          <path
            d="M-40 280 Q 220 240 480 360 T 860 260"
            fill="none"
            stroke="oklch(0.5 0.12 264)"
            strokeWidth="1"
          />
          <path
            d="M0 420 Q 300 380 550 500 T 900 400"
            fill="none"
            stroke="oklch(0.45 0.1 270)"
            strokeWidth="1"
          />
        </svg>

        <div className="relative z-10 flex flex-1 flex-col p-10 xl:p-12">
          <div className="mb-10 grid grid-cols-3 gap-3">
            {LOGIN_IMAGES.map(({ src, alt, offset }) => (
              <div
                key={src}
                className={cn(
                  "relative aspect-[4/3] overflow-hidden rounded-xl bg-[oklch(0.22_0.06_264)] ring-1 ring-white/10",
                  offset && "mt-6"
                )}
              >
                <Image
                  src={src}
                  alt={alt}
                  fill
                  sizes="(min-width: 1024px) 20vw, 33vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.16_0.04_264/0.55)] via-[oklch(0.16_0.04_264/0.15)] to-transparent" />
                <div className="absolute inset-0 bg-[oklch(0.28_0.07_264/0.2)] mix-blend-multiply" />
              </div>
            ))}
          </div>

          <div className="mt-auto max-w-lg space-y-5">
            <p className="text-xs font-semibold tracking-[0.2em] text-[oklch(0.72_0.14_250)] uppercase">
              GS Technology Admin Portal
            </p>
            <h2 className="text-3xl leading-tight font-semibold tracking-tight text-white xl:text-4xl">
              Run Your Store.
              <br />
              Make Every Sale Count.
            </h2>
            <p className="text-sm leading-relaxed text-white/65">
              A centralized platform for inventory, purchase orders, sales,
              repairs, and reporting — helping your team work faster with one
              connected view of the business.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              {FEATURES.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/85 backdrop-blur-sm"
                >
                  <Icon className="size-3.5 text-[oklch(0.72_0.14_250)]" />
                  {label}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-2 text-xs text-white/50">
              <div className="flex -space-x-2">
                {["GS", "POS", "INV", "RPT"].map((initials) => (
                  <span
                    key={initials}
                    className="flex size-7 items-center justify-center rounded-full border-2 border-[oklch(0.16_0.04_264)] bg-[oklch(0.32_0.08_264)] text-[10px] font-semibold text-white/90"
                  >
                    {initials}
                  </span>
                ))}
              </div>
              <span className="flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-[oklch(0.72_0.14_250)]" />
                One connected view of your operations
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
