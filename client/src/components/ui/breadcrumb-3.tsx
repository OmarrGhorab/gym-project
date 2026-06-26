import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDaysIcon,
  ChevronRightIcon,
  FileTextIcon,
  HomeIcon,
} from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

type BreadcrumbSegment =
  | {
      label: string;
      href: string;
      icon: LucideIcon;
      current?: false;
    }
  | {
      label: string;
      icon: LucideIcon;
      current: true;
      href?: never;
    };

type Breadcrumb3Props = {
  segments?: readonly BreadcrumbSegment[];
  homeHref?: string;
  homeLabel?: string;
  currentLabel?: string;
  currentIcon?: LucideIcon;
  dateLabel?: string;
  className?: string;
};

const Breadcrumb3 = ({
  segments,
  homeHref = "#",
  homeLabel = "Home",
  currentLabel = "Revenue Summary",
  currentIcon: CurrentIcon = FileTextIcon,
  dateLabel,
  className,
}: Breadcrumb3Props) => {
  const resolvedSegments =
    segments ??
    ([
      { label: homeLabel, href: homeHref, icon: HomeIcon },
      { label: currentLabel, icon: CurrentIcon, current: true },
    ] satisfies readonly BreadcrumbSegment[]);

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList className="gap-1.5 text-sm">
        {resolvedSegments.map((segment, index) => {
          const Icon = segment.icon;

          return (
            <React.Fragment key={`${segment.label}-${index}`}>
              <BreadcrumbItem>
                {"href" in segment ? (
                  <BreadcrumbLink
                    href={segment.href}
                    className="flex items-center gap-1.5 rounded-sm px-1 py-0.5 hover:text-foreground"
                  >
                    <Icon className="size-3.5 text-muted-foreground" />
                    <span>{segment.label}</span>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="flex items-center gap-1.5 rounded-sm px-1 py-0.5 font-medium">
                    <Icon className="size-3.5 text-foreground/80" />
                    {segment.label}
                  </BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {index < resolvedSegments.length - 1 ? (
                <BreadcrumbSeparator className="text-muted-foreground/70">
                  <ChevronRightIcon className="rtl:rotate-180" />
                </BreadcrumbSeparator>
              ) : null}
            </React.Fragment>
          );
        })}
        {dateLabel ? (
          <>
            <BreadcrumbSeparator className="text-muted-foreground/70">
              <ChevronRightIcon className="rtl:rotate-180" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-sm px-1 py-0.5",
                  "text-muted-foreground"
                )}
              >
                <CalendarDaysIcon className="size-3.5" />
                {dateLabel}
              </span>
            </BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export type { BreadcrumbSegment };
export default Breadcrumb3;
