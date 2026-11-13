// Seed navigation data for the generated sidebar — replace with your own.
import { type IconName } from "@/lib/icon-context";

export interface NavItem {
  label: string;
  /** Key into the icon context (lucide by default). */
  icon: IconName;
  badge?: string;
  active?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Platform",
    items: [
      { label: "Home", icon: "home", active: true },
      { label: "Inbox", icon: "inbox" },
      { label: "Calendar", icon: "calendar" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Notifications", icon: "bell" },
      { label: "Favorites", icon: "star" },
    ],
  },
];

