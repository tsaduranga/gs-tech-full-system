import { AuthProvider } from "@/lib/auth-context";
import { DashboardFooterProvider } from "@/lib/dashboard-footer-context";
import { DashboardShell } from "@/components/dashboard-shell";
import { RoutePermissionGuard } from "@/components/route-permission-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <DashboardFooterProvider>
        <DashboardShell>
          <RoutePermissionGuard>{children}</RoutePermissionGuard>
        </DashboardShell>
      </DashboardFooterProvider>
    </AuthProvider>
  );
}
