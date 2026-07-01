"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { ClipboardCheck, Dumbbell, PackageSearch, Search, UserRound, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { NavMainItem } from "@/navigation/sidebar/sidebar-items";
import { sidebarItems } from "@/navigation/sidebar/sidebar-items";

type SearchItem = {
  id: string;
  group: string;
  label: string;
  url: string;
  icon?: NavMainItem["icon"];
  subtitle?: string;
  disabled?: boolean;
  newTab?: boolean;
  source?: "nav" | "backend";
  type?: string;
};

type BackendSearchResult = {
  id: string;
  group: string;
  subtitle?: string | null;
  title: string;
  type: "employee" | "member" | "product" | "subscription" | "task";
  url: string;
};

const sidebarGroupLabels = new Set(sidebarItems.flatMap((group) => (group.label ? [group.label] : [])));

function getSubItemGroup(groupLabel: string | undefined, itemTitle: string) {
  return sidebarGroupLabels.has(itemTitle) ? (groupLabel ?? "Other") : itemTitle;
}

const searchItems: SearchItem[] = sidebarItems.flatMap((group) =>
  group.items.flatMap((item) => {
    if (item.subItems) {
      return item.subItems.map((sub) => ({
        id: sub.id,
        group: getSubItemGroup(group.label, item.title),
        label: sub.title,
        url: sub.url,
        icon: item.icon,
        disabled: sub.disabled,
        newTab: sub.newTab,
      }));
    }
    return [
      {
        id: item.id,
        group: group.label ?? "Other",
        label: item.title,
        url: item.url,
        icon: item.icon,
        disabled: item.disabled,
        newTab: item.newTab,
      },
    ];
  }),
);

function getAvailableItems(items: SearchItem[]) {
  return items.filter((item) => !item.disabled && !item.url.includes("coming-soon"));
}

const recommendations = getAvailableItems(searchItems);
const backendIcons = {
  employee: Dumbbell,
  member: UserRound,
  product: PackageSearch,
  subscription: UsersRound,
  task: ClipboardCheck,
} satisfies Record<BackendSearchResult["type"], NavMainItem["icon"]>;

function groupBy(items: SearchItem[]) {
  const groups = [...new Set(items.map((item) => item.group))];
  return groups.map((group) => ({
    group,
    items: items.filter((item) => item.group === group),
  }));
}

export function SearchDialog() {
  const tShell = useTranslations("Dashboard.shell");
  const tNav = useTranslations("Dashboard.nav");
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [backendResults, setBackendResults] = React.useState<SearchItem[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "j" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) {
      setQuery("");
      setBackendResults([]);
    }
  };

  React.useEffect(() => {
    const normalizedQuery = query.trim();
    if (!open || normalizedQuery.length < 2) {
      setBackendResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);

      try {
        const params = new URLSearchParams({ limit: "5", q: normalizedQuery });
        const response = await fetch(`/api/dashboard/search?${params.toString()}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as { data?: BackendSearchResult[] };

        if (!controller.signal.aborted) {
          setBackendResults(
            (payload.data ?? []).map((item) => ({
              id: item.id,
              group: item.group,
              label: item.title,
              subtitle: item.subtitle ?? undefined,
              url: item.url,
              icon: backendIcons[item.type],
              source: "backend",
              type: item.type,
            })),
          );
        }
      } catch {
        if (!controller.signal.aborted) {
          setBackendResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 220);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, query]);

  const handleSelect = (item: SearchItem) => {
    if (item.disabled) return;
    handleOpenChange(false);
    if (item.newTab) {
      window.open(item.url, "_blank", "noopener,noreferrer");
    } else {
      router.push(item.url);
    }
  };

  const renderGroups = (items: SearchItem[]) =>
    groupBy(items).map(({ group, items: groupItems }, index) => (
      <React.Fragment key={group}>
        {index > 0 && <CommandSeparator />}
        <CommandGroup heading={getSearchGroupLabel(group, tNav, tShell)}>
          {groupItems.map((item) => (
            <CommandItem
              disabled={item.disabled}
              key={`${group}-${item.id}`}
              value={`${getSearchGroupLabel(item.group, tNav, tShell)} ${getItemLabel(item, tNav)} ${item.subtitle ?? ""}`}
              onSelect={() => handleSelect(item)}
            >
              <span className="flex min-w-0 items-center gap-2">
                {item.icon && <item.icon />}
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{getItemLabel(item, tNav)}</span>
                  {item.subtitle ? <span className="truncate text-muted-foreground text-xs">{item.subtitle}</span> : null}
                </span>
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </React.Fragment>
    ));

  return (
    <>
      <Button
        onClick={() => handleOpenChange(true)}
        variant="link"
        className="px-0! font-normal text-muted-foreground hover:no-underline"
      >
        <Search data-icon="inline-start" />
        {tShell("search")}
        <kbd className="inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-medium text-[10px]">
          <span className="text-xs">⌘</span>J
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={handleOpenChange}>
        <Command>
          <CommandInput placeholder={tShell("searchPlaceholder")} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{tShell("noResults")}</CommandEmpty>
            {query.trim().length >= 2 && backendResults.length > 0 ? renderGroups(backendResults) : null}
            {query.trim().length >= 2 && backendResults.length > 0 ? <CommandSeparator /> : null}
            {query.trim().length >= 2 ? renderGroups(searchItems) : renderGroups(recommendations)}
            {isSearching ? <div className="px-2 py-3 text-muted-foreground text-sm">{tShell("searching")}</div> : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

function getItemLabel(item: SearchItem, tNav: ReturnType<typeof useTranslations>) {
  return item.source === "backend" ? item.label : tNav(`items.${item.id}`);
}

function getSearchGroupLabel(
  group: string,
  tNav: ReturnType<typeof useTranslations>,
  tShell: ReturnType<typeof useTranslations>,
) {
  if (group === "Dashboards" || group === "Gym Workspace") {
    return tNav("groups.dashboards");
  }

  if (group === "Pages" || group === "Management") {
    return tNav("groups.pages");
  }

  if (group === "Other") {
    return tShell("other");
  }

  const matchingItem = sidebarItems.flatMap((itemGroup) => itemGroup.items).find((item) => item.title === group);

  return matchingItem ? tNav(`items.${matchingItem.id}`) : group;
}
