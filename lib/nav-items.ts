import {
  LayoutDashboard,
  Users,
  Wallet,
  HandCoins,
  MoreHorizontal,
  TrendingUp,
  Gift,
  Receipt,
  FileBarChart,
  Settings,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  labelKey:
    | "dashboard"
    | "members"
    | "payments"
    | "payouts"
    | "more"
    | "income"
    | "donations"
    | "expenses"
    | "reports"
    | "settings"
    | "auditLog";
  icon: LucideIcon;
};

/** Shown in the mobile bottom nav (max 5) and mirrored at the top of the desktop sidebar. */
export const primaryNavItems: NavItem[] = [
  { href: "/", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/members", labelKey: "members", icon: Users },
  { href: "/payments", labelKey: "payments", icon: Wallet },
  { href: "/payouts", labelKey: "payouts", icon: HandCoins },
  { href: "/more", labelKey: "more", icon: MoreHorizontal },
];

/** Only reachable via "More" on mobile; shown directly in the desktop sidebar. */
export const secondaryNavItems: NavItem[] = [
  { href: "/income", labelKey: "income", icon: TrendingUp },
  { href: "/donations", labelKey: "donations", icon: Gift },
  { href: "/expenses", labelKey: "expenses", icon: Receipt },
  { href: "/reports", labelKey: "reports", icon: FileBarChart },
  { href: "/settings", labelKey: "settings", icon: Settings },
  { href: "/audit-log", labelKey: "auditLog", icon: ScrollText },
];
