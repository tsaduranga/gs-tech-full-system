import { AuthProvider } from "@/lib/auth-context";
import { DashboardShell } from "@/components/dashboard-shell";
import { RoutePermissionGuard } from "@/components/route-permission-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <DashboardShell>
        <RoutePermissionGuard>{children}</RoutePermissionGuard>
      </DashboardShell>
    </AuthProvider>
  );
}
