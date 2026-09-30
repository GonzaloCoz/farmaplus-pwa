"use client";

import type { ComponentType } from "react";

// ── Lucide ──────────────────────────────────────────────────
import {
  ChevronRight,
  ChevronDown,
  X,
  Copy,
  Menu,
  Dot,
  Monitor,
  Sun,
  Moon,
  RectangleHorizontal,
  Circle,
  SquareLibrary,
  Clock,
  Star,
  Settings,
  Plus,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Search,
  Loader,
  Users,
  Lock,
  Mail,
  Bell,
  Shield,
  Palette,
  Lightbulb,
  Rocket,
  Heart,
  Paintbrush,
  Brain,
  Globe,
  User,
  ImageIcon,
  Link,
  Check,
  RotateCcw,
  Play,
  Pause,
  Pipette,
  Home,
  MessageCircle,
  Inbox,
  Pencil,
  SkipForward,
  CornerDownRight,
} from "lucide-react";

// ── HugeIcons ───────────────────────────────────────────────
import { HugeiconsIcon } from "@hugeicons/react";
import HiChevronRight from "@hugeicons/core-free-icons/ArrowRight01Icon";
import HiChevronDown from "@hugeicons/core-free-icons/ArrowDown01Icon";
import HiDropper from "@hugeicons/core-free-icons/DropperIcon";
import HiX from "@hugeicons/core-free-icons/Cancel01Icon";
import HiCopy from "@hugeicons/core-free-icons/Copy01Icon";
import HiMenu from "@hugeicons/core-free-icons/Menu01Icon";
import HiDot from "@hugeicons/core-free-icons/CircleIcon";
import HiMonitor from "@hugeicons/core-free-icons/ComputerIcon";
import HiSun from "@hugeicons/core-free-icons/Sun01Icon";
import HiMoon from "@hugeicons/core-free-icons/Moon01Icon";
import HiRectangle from "@hugeicons/core-free-icons/DashboardCircleIcon";
import HiLibrary from "@hugeicons/core-free-icons/LibraryIcon";
import HiClock from "@hugeicons/core-free-icons/Clock01Icon";
import HiStar from "@hugeicons/core-free-icons/StarIcon";
import HiSettings from "@hugeicons/core-free-icons/Settings01Icon";
import HiPlus from "@hugeicons/core-free-icons/PlusSignIcon";
import HiArrowLeft from "@hugeicons/core-free-icons/ArrowLeft01Icon";
import HiArrowRight from "@hugeicons/core-free-icons/ArrowRight01Icon";
import HiArrowUp from "@hugeicons/core-free-icons/ArrowUp01Icon";
import HiSearch from "@hugeicons/core-free-icons/Search01Icon";
import HiLoader from "@hugeicons/core-free-icons/Loading01Icon";
import HiUsers from "@hugeicons/core-free-icons/UserGroupIcon";
import HiLock from "@hugeicons/core-free-icons/LockIcon";
import HiMail from "@hugeicons/core-free-icons/Mail01Icon";
import HiBell from "@hugeicons/core-free-icons/Notification01Icon";
import HiShield from "@hugeicons/core-free-icons/Shield01Icon";
import HiPalette from "@hugeicons/core-free-icons/PaintBrush01Icon";
import HiLightbulb from "@hugeicons/core-free-icons/BulbIcon";
import HiRocket from "@hugeicons/core-free-icons/Rocket01Icon";
import HiHeart from "@hugeicons/core-free-icons/FavouriteIcon";
import HiPaintbrush from "@hugeicons/core-free-icons/PaintBrush02Icon";
import HiBrain from "@hugeicons/core-free-icons/BrainIcon";
import HiGlobe from "@hugeicons/core-free-icons/GlobeIcon";
import HiUser from "@hugeicons/core-free-icons/UserIcon";
import HiImage from "@hugeicons/core-free-icons/Image01Icon";
import HiLink from "@hugeicons/core-free-icons/Link01Icon";
import HiCheck from "@hugeicons/core-free-icons/Tick02Icon";
import HiRotateCcw from "@hugeicons/core-free-icons/ArrowReloadHorizontalIcon";
import HiHome from "@hugeicons/core-free-icons/Home01Icon";
import HiMessage from "@hugeicons/core-free-icons/BubbleChatIcon";
import HiInbox from "@hugeicons/core-free-icons/InboxIcon";
import HiPencil from "@hugeicons/core-free-icons/PencilEdit01Icon";
import HiSkipForward from "@hugeicons/core-free-icons/NextIcon";
import HiCornerDownRight from "@hugeicons/core-free-icons/ArrowMoveDownRightIcon";

// ── Untitled UI ─────────────────────────────────────────────
// Aliased with a Uui prefix to avoid collisions with the Lucide imports above.
import {
  ChevronRight as UuiChevronRight,
  ChevronDown as UuiChevronDown,
  Dropper as UuiDropper,
  XClose as UuiX,
  Copy01 as UuiCopy,
  Menu01 as UuiMenu,
  Monitor01 as UuiMonitor,
  Sun as UuiSun,
  Moon01 as UuiMoon,
  Square as UuiSquare,
  Circle as UuiCircle,
  BookClosed as UuiBook,
  Clock as UuiClock,
  Star01 as UuiStar,
  Settings01 as UuiSettings,
  Plus as UuiPlus,
  ArrowLeft as UuiArrowLeft,
  ArrowRight as UuiArrowRight,
  ArrowUp as UuiArrowUp,
  SearchMd as UuiSearch,
  Loading01 as UuiLoader,
  Users01 as UuiUsers,
  Lock01 as UuiLock,
  Mail01 as UuiMail,
  Bell01 as UuiBell,
  Shield01 as UuiShield,
  Palette as UuiPalette,
  Lightbulb01 as UuiLightbulb,
  Rocket01 as UuiRocket,
  Heart as UuiHeart,
  Brush01 as UuiBrush,
  CpuChip01 as UuiCpuChip,
  Globe01 as UuiGlobe,
  User01 as UuiUser,
  Image01 as UuiImage,
  Link01 as UuiLink,
  Check as UuiCheck,
  RefreshCcw01 as UuiRotateCcw,
  Home01 as UuiHome,
  MessageCircle01 as UuiMessage,
  Inbox01 as UuiInbox,
  Pencil01 as UuiPencil,
  SkipForward as UuiSkipForward,
  CornerDownRight as UuiCornerDownRight,
} from "@untitledui/icons";

// ── Types ───────────────────────────────────────────────────

export interface IconComponentProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export type IconComponent = ComponentType<any>;

export type IconLibrary = "lucide" | "tabler" | "phosphor" | "hugeicons" | "untitledui";

export type IconName =
  | "chevron-right" | "chevron-down" | "x" | "copy" | "menu" | "dot"
  | "monitor" | "sun" | "moon" | "rectangle-horizontal" | "circle"
  | "square-library" | "clock" | "star" | "settings"
  | "plus" | "arrow-left" | "arrow-right" | "arrow-up" | "search" | "loader"
  | "users" | "lock" | "mail" | "bell" | "shield" | "palette"
  | "lightbulb" | "rocket" | "heart" | "paintbrush" | "brain"
  | "globe" | "user"
  | "image" | "link" | "check" | "rotate-ccw"
  | "play" | "pause" | "pipette"
  | "home" | "message-circle" | "inbox"
  | "pencil" | "skip-forward" | "corner-down-right";

export const iconLibraryOrder: IconLibrary[] = ["lucide", "hugeicons", "untitledui"];

export const iconLibraryLabels: Record<IconLibrary, string> = {
  lucide: "Lucide",
  tabler: "Tabler",
  phosphor: "Phosphor",
  hugeicons: "HugeIcons",
  untitledui: "Untitled UI",
};

// ── Adapter Factories ───────────────────────────────────────

// HugeIcons: wraps icon definition in HugeiconsIcon renderer
function hugeicons(iconDef: unknown): IconComponent {
  return function HugeIconsAdapter({ size, strokeWidth, className }: IconComponentProps) {
    return (
      <HugeiconsIcon
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        icon={iconDef as any}
        size={size}
        strokeWidth={strokeWidth}
        className={className}
      />
    );
  };
}

// Untitled UI: standard 24px SVG components — `strokeWidth`/`className` pass
// through natively; only `size` needs mapping to `width`/`height`.
function untitledui(Icon: ComponentType<any>): IconComponent {
  return function UntitledUiAdapter({ size, strokeWidth, className }: IconComponentProps) {
    return <Icon width={size} height={size} strokeWidth={strokeWidth} className={className} />;
  };
}

// ── Icon Maps ───────────────────────────────────────────────

const lucideMap: Record<IconName, IconComponent> = {
  "chevron-right": ChevronRight,
  "chevron-down": ChevronDown,
  "pipette": Pipette,
  "x": X,
  "copy": Copy,
  "menu": Menu,
  "dot": Dot,
  "monitor": Monitor,
  "sun": Sun,
  "moon": Moon,
  "rectangle-horizontal": RectangleHorizontal,
  "circle": Circle,
  "square-library": SquareLibrary,
  "clock": Clock,
  "star": Star,
  "settings": Settings,
  "plus": Plus,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "arrow-up": ArrowUp,
  "search": Search,
  "loader": Loader,
  "users": Users,
  "lock": Lock,
  "mail": Mail,
  "bell": Bell,
  "shield": Shield,
  "palette": Palette,
  "lightbulb": Lightbulb,
  "rocket": Rocket,
  "heart": Heart,
  "paintbrush": Paintbrush,
  "brain": Brain,
  "globe": Globe,
  "user": User,
  "image": ImageIcon,
  "link": Link,
  "check": Check,
  "rotate-ccw": RotateCcw,
  "play": Play,
  "pause": Pause,
  "home": Home,
  "message-circle": MessageCircle,
  "inbox": Inbox,
  "pencil": Pencil,
  "skip-forward": SkipForward,
  "corner-down-right": CornerDownRight,
};

const hugeiconsMap: Record<IconName, IconComponent> = {
  "chevron-right": hugeicons(HiChevronRight),
  "chevron-down": hugeicons(HiChevronDown),
  "pipette": hugeicons(HiDropper),
  "x": hugeicons(HiX),
  "copy": hugeicons(HiCopy),
  "menu": hugeicons(HiMenu),
  "dot": hugeicons(HiDot),
  "monitor": hugeicons(HiMonitor),
  "sun": hugeicons(HiSun),
  "moon": hugeicons(HiMoon),
  "rectangle-horizontal": hugeicons(HiRectangle),
  "circle": hugeicons(HiDot),
  "square-library": hugeicons(HiLibrary),
  "clock": hugeicons(HiClock),
  "star": hugeicons(HiStar),
  "settings": hugeicons(HiSettings),
  "plus": hugeicons(HiPlus),
  "arrow-left": hugeicons(HiArrowLeft),
  "arrow-right": hugeicons(HiArrowRight),
  "arrow-up": hugeicons(HiArrowUp),
  "search": hugeicons(HiSearch),
  "loader": hugeicons(HiLoader),
  "users": hugeicons(HiUsers),
  "lock": hugeicons(HiLock),
  "mail": hugeicons(HiMail),
  "bell": hugeicons(HiBell),
  "shield": hugeicons(HiShield),
  "palette": hugeicons(HiPalette),
  "lightbulb": hugeicons(HiLightbulb),
  "rocket": hugeicons(HiRocket),
  "heart": hugeicons(HiHeart),
  "paintbrush": hugeicons(HiPaintbrush),
  "brain": hugeicons(HiBrain),
  "globe": hugeicons(HiGlobe),
  "user": hugeicons(HiUser),
  "image": hugeicons(HiImage),
  "link": hugeicons(HiLink),
  "check": hugeicons(HiCheck),
  "rotate-ccw": hugeicons(HiRotateCcw),
  "play": Play,
  "pause": Pause,
  "home": hugeicons(HiHome),
  "message-circle": hugeicons(HiMessage),
  "inbox": hugeicons(HiInbox),
  "pencil": hugeicons(HiPencil),
  "skip-forward": hugeicons(HiSkipForward),
  "corner-down-right": hugeicons(HiCornerDownRight),
};

const untitleduiMap: Record<IconName, IconComponent> = {
  "chevron-right": untitledui(UuiChevronRight),
  "chevron-down": untitledui(UuiChevronDown),
  "pipette": untitledui(UuiDropper),
  "x": untitledui(UuiX),
  "copy": untitledui(UuiCopy),
  "menu": untitledui(UuiMenu),
  "dot": untitledui(UuiCircle),
  "monitor": untitledui(UuiMonitor),
  "sun": untitledui(UuiSun),
  "moon": untitledui(UuiMoon),
  "rectangle-horizontal": untitledui(UuiSquare),
  "circle": untitledui(UuiCircle),
  "square-library": untitledui(UuiBook),
  "clock": untitledui(UuiClock),
  "star": untitledui(UuiStar),
  "settings": untitledui(UuiSettings),
  "plus": untitledui(UuiPlus),
  "arrow-left": untitledui(UuiArrowLeft),
  "arrow-right": untitledui(UuiArrowRight),
  "arrow-up": untitledui(UuiArrowUp),
  "search": untitledui(UuiSearch),
  "loader": untitledui(UuiLoader),
  "users": untitledui(UuiUsers),
  "lock": untitledui(UuiLock),
  "mail": untitledui(UuiMail),
  "bell": untitledui(UuiBell),
  "shield": untitledui(UuiShield),
  "palette": untitledui(UuiPalette),
  "lightbulb": untitledui(UuiLightbulb),
  "rocket": untitledui(UuiRocket),
  "heart": untitledui(UuiHeart),
  "paintbrush": untitledui(UuiBrush),
  "brain": untitledui(UuiCpuChip),
  "globe": untitledui(UuiGlobe),
  "user": untitledui(UuiUser),
  "image": untitledui(UuiImage),
  "link": untitledui(UuiLink),
  "check": untitledui(UuiCheck),
  "rotate-ccw": untitledui(UuiRotateCcw),
  "play": Play,
  "pause": Pause,
  "home": untitledui(UuiHome),
  "message-circle": untitledui(UuiMessage),
  "inbox": untitledui(UuiInbox),
  "pencil": untitledui(UuiPencil),
  "skip-forward": untitledui(UuiSkipForward),
  "corner-down-right": untitledui(UuiCornerDownRight),
};

export const iconMap: Record<IconLibrary, Record<IconName, IconComponent>> = {
  lucide: lucideMap,
  tabler: lucideMap,
  phosphor: lucideMap,
  hugeicons: hugeiconsMap,
  untitledui: untitleduiMap,
};
