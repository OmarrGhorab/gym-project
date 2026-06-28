import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDaysIcon,
  ChevronRightIcon,
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
  dateLabel?: string;
  className?: string;
} & (
  | {
      segments: readonly BreadcrumbSegment[];
      homeHref?: never;
      homeLabel?: never;
      currentLabel?: never;
      currentIcon?: never;
    }
  | {
      segments?: never;
      homeHref: string;
      homeLabel: string;
      currentLabel: string;
      currentIcon: LucideIcon;
    }
);

const Breadcrumb3 = (props: Breadcrumb3Props) => {
  const { dateLabel, className } = props;
  const resolvedSegments =
    "segments" in props && props.segments
      ? props.segments
      : ([
          { label: props.homeLabel, href: props.homeHref, icon: HomeIcon },
          {
            label: props.currentLabel,
            icon: props.currentIcon,
            current: true,
          },
        ] satisfies readonly BreadcrumbSegment[]);

  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center gap-1.5 text-sm text-muted-foreground",
        className
      )}
    >
      <Breadcrumb>
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
                      <Icon
                        className="size-3.5 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span>{segment.label}</span>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="flex items-center gap-1.5 rounded-sm px-1 py-0.5 font-medium">
                      <Icon
                        className="size-3.5 text-foreground/80"
                        aria-hidden="true"
                      />
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
        </BreadcrumbList>
      </Breadcrumb>
      {dateLabel ? (
        <span className="flex items-center gap-1.5 rounded-sm px-1 py-0.5 text-muted-foreground">
          <CalendarDaysIcon className="size-3.5" aria-hidden="true" />
          {dateLabel}
        </span>
      ) : null}
    </div>
  );
};

export type { BreadcrumbSegment };
export default Breadcrumb3;
