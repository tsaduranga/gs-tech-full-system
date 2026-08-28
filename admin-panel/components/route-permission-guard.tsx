"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import {
  getFirstAccessibleRoute,
  getRoutePermission,
} from "@/lib/route-permissions";

export function RoutePermissionGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, permissions, hasPermission } = useAuth();
  const config = getRoutePermission(pathname);

  useEffect(() => {
    if (loading || !config) return;
    if (hasPermission(config.view)) return;

    const fallback = getFirstAccessibleRoute(permissions);
    router.replace(fallback ?? "/login");
  }, [loading, config, hasPermission, permissions, router]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (config && !hasPermission(config.view)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center gap-2 text-center">
            <ShieldOff className="size-10 text-muted-foreground" aria-hidden />
            <CardTitle>Access denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            You do not have permission to view this page.
          </CardContent>
        </Card>
      </div>
    );
  }

  return children;
}
