"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  ArrowLeftRight,
  BarChart3,
  Boxes,
  Building2,
  ChevronDown,
  ClipboardList,
  CornerDownLeft,
  Database,
  FileSpreadsheet,
  FileStack,
  FileText,
  FolderTree,
  History,
  KeyRound,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  LineChart,
  ListOrdered,
  LogOut,
  Menu,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  Package,
  PieChart,
  Receipt,
  Shield,
  ShoppingBasket,
  ShoppingCart,
  Sparkles,
  Truck,
  Undo2,
  UserCircle,
  Users,
  Warehouse,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";
import { apiJson } from "@/lib/api";
import {
  clearSession,
  getStoredAccess,
  getStoredRefresh,
  getStoredUser,
} from "@/lib/auth-storage";

type NavLeaf = {
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon;
};

type NavSection = {
  readonly heading: string;
  readonly sectionIcon: LucideIcon;
  readonly children: readonly NavLeaf[];
};

const USER_MANAGEMENT_CHILDREN: readonly NavLeaf[] = [
  { href: "/dashboard/users", label: "Users", icon: Users },
  { href: "/dashboard/roles", label: "Roles", icon: Shield },
  { href: "/dashboard/permissions", label: "Permissions", icon: KeyRound },
] as const;

const MASTER_DATA_CHILDREN: readonly NavLeaf[] = [
  { href: "/dashboard/customers", label: "Customers", icon: Building2 },
  { href: "/dashboard/suppliers", label: "Suppliers", icon: Truck },
  { href: "/dashboard/warehouses", label: "Warehouses", icon: Warehouse },
  { href: "/dashboard/categories", label: "Categories", icon: FolderTree },
  { href: "/dashboard/subcategories", label: "Subcategories", icon: Layers },
  { href: "/dashboard/items", label: "Items", icon: Package },
] as const;

const INVENTORY_CHILDREN: readonly NavLeaf[] = [
  { href: "/dashboard/stock", label: "Stock", icon: Boxes },
  { href: "/dashboard/transfer-items", label: "Transfer items", icon: ArrowLeftRight },
  { href: "/dashboard/transfer-history", label: "Transfer history", icon: History },
] as const;

const PURCHASING_CHILDREN: readonly NavLeaf[] = [
  { href: "/dashboard/purchase-orders", label: "Purchase orders", icon: ShoppingCart },
  {
    href: "/dashboard/purchase-order-history",
    label: "Purchase order history",
    icon: ClipboardList,
  },
  { href: "/dashboard/goods-receipts", label: "Goods receipt (GRN)", icon: PackageCheck },
  { href: "/dashboard/goods-receipt-history", label: "GRN history", icon: FileStack },
  { href: "/dashboard/supplier-returns", label: "Supplier returns", icon: PackageMinus },
  {
    href: "/dashboard/supplier-return-history",
    label: "Supplier return history",
    icon: Undo2,
  },
] as const;

const SALES_CHILDREN: readonly NavLeaf[] = [
  { href: "/dashboard/quotations", label: "Quotations", icon: FileText },
  {
    href: "/dashboard/quotation-history",
    label: "Quotation history",
    icon: FileSpreadsheet,
  },
  { href: "/dashboard/sales-orders", label: "Sales orders", icon: ShoppingBasket },
  {
    href: "/dashboard/sales-order-history",
    label: "Sales order history",
    icon: ListOrdered,
  },
  { href: "/dashboard/invoices", label: "Invoices", icon: Receipt },
  { href: "/dashboard/invoice-history", label: "Invoice history", icon: Archive },
  { href: "/dashboard/customer-returns", label: "Customer returns", icon: PackagePlus },
  {
    href: "/dashboard/customer-return-history",
    label: "Customer return history",
    icon: CornerDownLeft,
  },
] as const;

const SERVICE_CHILDREN: readonly NavLeaf[] = [
  { href: "/dashboard/repairs", label: "Repairs", icon: Wrench },
  { href: "/dashboard/repair-history", label: "Repair history", icon: History },
] as const;

const REPORTS_CHILDREN: readonly NavLeaf[] = [
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
] as const;

const NAV_MAIN: readonly (
  | { readonly href: string; readonly label: string; readonly icon: LucideIcon }
  | NavSection
)[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    heading: "User Management",
    sectionIcon: UserCircle,
    children: USER_MANAGEMENT_CHILDREN,
  },
  {
    heading: "Master Data",
    sectionIcon: Database,
    children: MASTER_DATA_CHILDREN,
  },
  {
    heading: "Inventory",
    sectionIcon: Boxes,
    children: INVENTORY_CHILDREN,
  },
  {
    heading: "Purchasing",
    sectionIcon: ShoppingCart,
    children: PURCHASING_CHILDREN,
  },
  {
    heading: "Sales",
    sectionIcon: LineChart,
    children: SALES_CHILDREN,
  },
  {
    heading: "Service",
    sectionIcon: LifeBuoy,
    children: SERVICE_CHILDREN,
  },
  {
    heading: "Reports",
    sectionIcon: PieChart,
    children: REPORTS_CHILDREN,
  },
] as const;

function sectionKey(heading: string) {
  return heading.toLowerCase().replace(/\s+/g, "-");
}

function NavLinks({
  onNavigate,
  collapsedSections,
  toggleSection,
}: {
  onNavigate?: () => void;
  collapsedSections: ReadonlySet<string>;
  toggleSection: (key: string) => void;
}) {
  const path = usePathname();

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {NAV_MAIN.map((entry) => {
        if ("heading" in entry) {
          const key = sectionKey(entry.heading);
          const collapsed = collapsedSections.has(key);
          const anyChildActive = entry.children.some((c) => path === c.href);
          const SectionIcon = entry.sectionIcon;

          return (
            <div key={entry.heading} className="pt-3 first:pt-0">
              <button
                type="button"
                aria-expanded={!collapsed}
                aria-controls={`nav-section-${key}`}
                onClick={() => toggleSection(key)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors",
                  "hover:bg-sidebar-accent/60",
                  anyChildActive && !collapsed && "bg-sidebar-accent/25"
                )}
              >
                <SectionIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {entry.heading}
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                    collapsed && "-rotate-90"
                  )}
                  aria-hidden
                />
              </button>
              <div
                id={`nav-section-${key}`}
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out",
                  collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
                )}
              >
                <div className="overflow-hidden">
                  <div className="mt-1 flex flex-col gap-0.5 border-l border-sidebar-border/60 py-1 pl-2 ml-3">
                    {entry.children.map((child) => {
                      const active = path === child.href;
                      const Icon = child.icon;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={onNavigate}
                          className={cn(
                            "group flex items-center gap-2.5 rounded-md py-2 pr-2 pl-2 text-[13px] leading-tight transition-colors",
                            active
                              ? "bg-sidebar-primary/12 font-medium text-sidebar-foreground shadow-sm ring-1 ring-sidebar-primary/25"
                              : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                          )}
                          aria-current={active ? "page" : undefined}
                        >
                          <Icon
                            className={cn(
                              "size-4 shrink-0 transition-opacity",
                              active
                                ? "text-primary opacity-100"
                                : "text-muted-foreground opacity-80 group-hover:opacity-100"
                            )}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1">{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        }

        const active = path === entry.href;
        const Icon = entry.icon;
        return (
          <Link
            key={entry.href}
            href={entry.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-primary/12 text-sidebar-foreground ring-1 ring-sidebar-primary/30"
                : "text-sidebar-foreground/90 hover:bg-sidebar-accent"
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon
              className={cn(
                "size-[18px] shrink-0",
                active ? "text-primary" : "text-muted-foreground"
              )}
              aria-hidden
            />
            {entry.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = getStoredUser();

  const storageKey = "pos-admin-sidebar-collapsed-sections";

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set()
  );

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw)
        setCollapsedSections(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const persistCollapsed = useCallback((next: Set<string>) => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const toggleSection = useCallback(
    (key: string) => {
      setCollapsedSections((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        persistCollapsed(next);
        return next;
      });
    },
    [persistCollapsed]
  );

  useEffect(() => {
    if (!getStoredAccess()) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  const asideShell =
    "flex h-full flex-col border-border bg-sidebar text-sidebar-foreground";

  const mobileHeader = useMemo(
    () => (
      <div className="mb-4 flex items-center gap-2 border-b border-sidebar-border pb-4">
        <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary/15 ring-1 ring-sidebar-primary/30">
          <Sparkles className="size-[18px] text-primary" aria-hidden />
        </div>
        <div className="min-w-0">
          <p id="mobile-nav-title" className="truncate text-sm font-semibold tracking-tight">
            POS Admin
          </p>
          <p className="truncate text-xs text-muted-foreground">Control panel</p>
        </div>
      </div>
    ),
    []
  );

  async function logout() {
    const refresh = getStoredRefresh();
    await apiJson("/auth/logout", {
      method: "POST",
      body: JSON.stringify(refresh ? { refreshToken: refresh } : {}),
    });
    clearSession();
    router.replace("/login");
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          asideShell,
          "relative hidden w-64 shrink-0 border-r pt-5 pr-3 pb-6 pl-4 md:flex"
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-sidebar-primary/[0.08] to-transparent" />
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="mb-5 flex shrink-0 items-center gap-2.5 px-1">
            <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary/15 ring-1 ring-sidebar-primary/35">
              <LayoutDashboard className="size-[18px] text-primary" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-semibold tracking-tight text-sidebar-foreground">
                POS Admin
              </h1>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Operations
              </p>
            </div>
          </div>

          <div className="-mr-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-2">
            <NavLinks
              collapsedSections={collapsedSections}
              toggleSection={toggleSection}
            />
          </div>

          <div className="mt-4 shrink-0 border-t border-sidebar-border pt-4 text-xs text-muted-foreground">
            <span className="truncate block font-medium">{user?.username ?? "Signed in"}</span>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-40 flex shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/75">
          <Button
            variant="outline"
            size="icon-sm"
            type="button"
            className="md:hidden"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-drawer"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-4" />
          </Button>
          <span className="flex-1 truncate text-sm font-semibold tracking-tight md:hidden">
            POS Admin
          </span>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user?.username}
            </span>
            <ModeToggle />
            <Button variant="outline" size="sm" onClick={() => logout()}>
              <LogOut className="mr-1 size-3.5" />
              Sign out
            </Button>
          </div>
        </header>

        {mobileOpen ? (
          <div
            className="fixed inset-0 z-50 md:hidden"
            aria-hidden={false}
            id="mobile-nav-drawer"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            />
            <div
              className={cn(
                asideShell,
                "animate-in fade-in slide-in-from-left duration-200",
                "absolute inset-y-0 left-0 flex w-[min(300px,88vw)] flex-col p-5 shadow-xl"
              )}
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-nav-title"
            >
              {mobileHeader}
              <NavLinks
                onNavigate={() => setMobileOpen(false)}
                collapsedSections={collapsedSections}
                toggleSection={toggleSection}
              />
            </div>
          </div>
        ) : null}

        <main className="flex-1 bg-background p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
