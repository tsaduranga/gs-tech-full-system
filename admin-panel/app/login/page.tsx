"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/api";
import {
  setSessionTokens,
  setStoredUser,
  getStoredAccess,
} from "@/lib/auth-storage";
import { useEffect } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("Admin123!");
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
      router.replace("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="justify-items-center gap-4 text-center">
          <div className="rounded-lg bg-white px-5 py-3 shadow-sm ring-1 ring-black/5">
            <Image
              src="/gs-technology-logo.png"
              alt="GS Technology"
              width={260}
              height={88}
              className="h-auto w-[220px] max-w-full object-contain"
              priority
            />
          </div>
          <CardTitle className="w-full">Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
        <p>Developed By Kalyt Solutions</p>
        <a
          href="tel:+94770604104"
          className="text-foreground/80 underline-offset-2 hover:text-foreground hover:underline"
        >
          077 0604104
        </a>
      </div>
    </div>
  );
}
