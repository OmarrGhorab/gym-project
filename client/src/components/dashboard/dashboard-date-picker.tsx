"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";
import { arEG, enUS } from "date-fns/locale";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const locales = {
  ar: arEG,
  en: enUS,
};

export function DashboardDatePicker({
  locale = "en",
  date,
}: {
  locale?: string;
  date?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const dateLocale = locales[locale as keyof typeof locales] ?? enUS;
  const selectedDate = date ? parseISO(date) : new Date();

  function handleSelect(date: Date | undefined) {
    if (!date) return;
    const dateStr = format(date, "yyyy-MM-dd");
    router.replace(`${pathname}?date=${dateStr}`);
    setIsOpen(false);
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        render={
          <Button className="gap-2" type="button" variant="outline">
            <CalendarDays className="size-4 text-primary" />
            <span className="text-sm font-semibold">
              {format(selectedDate, "PPP", { locale: dateLocale })}
            </span>
          </Button>
        }
      />
      <PopoverContent align="end" className="w-auto p-0" side="bottom">
        <Calendar
          locale={dateLocale}
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
        />
      </PopoverContent>
    </Popover>
  );
}
