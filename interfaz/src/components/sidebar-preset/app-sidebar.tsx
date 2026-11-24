"use client";

import { useState } from "react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  type SidebarProps,
} from "@/components/ui/sidebar";
import { useIcons } from "@/lib/icon-context";
import { fontWeights } from "@/lib/font-weight";
import { NAV_SECTIONS } from "@/components/sidebar-preset/nav-data";

export function AppSidebar(props: Omit<SidebarProps, "children">) {
  const [active, setActive] = useState("Home");
  const icons = useIcons();

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <div className="flex h-8 items-center px-2">
          <span
            className="min-w-0 truncate text-[length:var(--fs-body,13px)] leading-[var(--lh-body,20px)] text-foreground"
            style={{ fontVariationSettings: fontWeights.semibold }}
          >
            Configuración
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_SECTIONS.map((section) => (
          <SidebarGroup key={section.label} collapsible>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarMenu>
              {section.items.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    icon={icons[item.icon]}
                    isActive={item.label === active}
                    onClick={() => setActive(item.label)}
                  >
                    {item.label}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

