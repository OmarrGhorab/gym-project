import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  Activity,
  CalendarDays,
  CreditCard,
  Package,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata.Dashboard" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function DashboardOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Dashboard");
  const isArabic = locale === "ar";
  const copy = getDashboardCopy(isArabic);

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <span>{copy.date}</span>
            <span className="text-muted-foreground/50">/</span>
            <span>{copy.breadcrumb}</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-normal text-foreground">
            {t("title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-semibold text-muted-foreground shadow-sm">
          <CalendarDays className="size-4 text-primary" />
          {t("today")}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {copy.stats.map((stat) => (
          <Card key={stat.label} className="rounded-lg shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
              <CardTitle className="text-sm font-bold text-card-foreground">
                {stat.label}
              </CardTitle>
              <span className="grid size-8 place-items-center rounded-lg bg-primary/20 text-primary-foreground dark:text-primary">
                <stat.icon className="size-4" />
              </span>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-end justify-between gap-3">
                <p className="text-3xl font-black tracking-tight text-foreground">
                  {stat.value}
                </p>
                <stat.sparkline className="h-9 w-16 text-muted-foreground" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                {stat.hint}
                <span
                  className={cn(
                    "ms-2 font-bold",
                    stat.positive ? "text-emerald-600" : "text-rose-600"
                  )}
                >
                  {stat.change}
                </span>
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <Card className="rounded-lg shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold">
              {copy.revenueTitle}
            </CardTitle>
            <div className="flex rounded-md bg-muted p-1 text-xs font-bold text-muted-foreground">
              {["90d", "30d", "7d"].map((item) => (
                <span
                  key={item}
                  className={cn(
                    "rounded px-2 py-1",
                    item === "30d" && "bg-card text-foreground shadow-sm"
                  )}
                >
                  {item}
                </span>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <LineChartMock />
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">
              {copy.attendanceTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChartMock />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <DataPanel title={copy.topProductsTitle} rows={copy.products} />
        <DataPanel title={copy.lowStockTitle} rows={copy.stock} />

        <Card className="rounded-lg shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold">
              {copy.recentActivityTitle}
            </CardTitle>
            <span className="rounded-md bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">
              {copy.today}
            </span>
          </CardHeader>
          <CardContent className="space-y-4">
            {copy.timeline.map((item) => (
              <div key={`${item.time}-${item.title}`} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="grid size-8 place-items-center rounded-full bg-primary/20 text-primary-foreground dark:text-primary">
                    <Activity className="size-4" />
                  </span>
                  <span className="mt-2 h-full w-px bg-border" />
                </div>
                <div className="min-w-0 flex-1 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-foreground">
                      {item.title}
                    </p>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {item.time}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function DataPanel({ title, rows }: { title: string; rows: DataRow[] }) {
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-bold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.name}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b pb-3 text-sm last:border-0 last:pb-0"
            >
              <p className="min-w-0 truncate font-bold text-foreground">
                {row.name}
              </p>
              <span className="font-semibold text-muted-foreground">
                {row.meta}
              </span>
              <span
                className={cn(
                  "font-black",
                  row.danger ? "text-rose-600" : "text-foreground"
                )}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LineChartMock() {
  const points = [18, 36, 48, 21, 52, 31, 70, 42, 72, 45, 58];

  return (
    <div className="h-56 rounded-lg bg-muted p-4">
      <div className="flex h-full items-end gap-2 border-b border-b-border">
        {points.map((point, index) => (
          <div
            key={`${point}-${index}`}
            className="flex flex-1 flex-col items-center gap-2"
          >
            <div
              className="w-full rounded-t-md border border-primary/35 bg-primary/55"
              style={{ height: `${point}%` }}
            />
            <span className="text-[10px] font-semibold text-muted-foreground">
              {index + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChartMock() {
  const bars = [14, 18, 12, 28, 42, 58, 65, 61, 54, 88, 96, 78, 62, 39, 24, 12];

  return (
    <div className="h-56 rounded-lg bg-muted p-4">
      <div className="flex h-full items-end gap-2">
        {bars.map((bar, index) => (
          <div
            key={`${bar}-${index}`}
            className="flex-1 rounded-t-md bg-primary"
            style={{ height: `${bar}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function SparkLine({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 44" className={className} fill="none">
      <path
        d="M2 34L16 29L28 31L42 18L54 22L68 9L78 12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
    </svg>
  );
}

function SparkBars({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 44" className={className} fill="currentColor">
      {[12, 24, 18, 34, 28, 39].map((height, index) => (
        <rect
          key={height + index}
          height={height}
          rx="2"
          width="8"
          x={index * 13 + 2}
          y={42 - height}
        />
      ))}
    </svg>
  );
}

type DataRow = { name: string; meta: string; value: string; danger?: boolean };

function getDashboardCopy(isArabic: boolean) {
  return {
    date: isArabic ? "الأربعاء، 17 يونيو" : "Wednesday, Jun 17",
    breadcrumb: isArabic ? "الرئيسية" : "Home",
    today: isArabic ? "اليوم" : "Today",
    revenueTitle: isArabic
      ? "اتجاه الإيرادات الشهرية - آخر 30 يوم"
      : "Monthly revenue trend - last 30 days",
    attendanceTitle: isArabic ? "الحضور بالساعة" : "Attendance by hour",
    topProductsTitle: isArabic ? "المنتجات الأكثر بيعًا" : "Best selling products",
    lowStockTitle: isArabic ? "تنبيهات المخزون المنخفض" : "Low stock alerts",
    recentActivityTitle: isArabic ? "النشاط الأخير" : "Recent activity",
    stats: [
      {
        label: isArabic ? "إيرادات اليوم" : "Today revenue",
        value: "EGP 8,886",
        hint: "vs EGP 12,455",
        change: "-12.4%",
        positive: false,
        icon: TrendingUp,
        sparkline: SparkLine,
      },
      {
        label: isArabic ? "المبيعات اليوم" : "Today sales",
        value: "28",
        hint: isArabic ? "أعلى قيمة 18:00" : "Peak at 18:00",
        change: "+8.1%",
        positive: true,
        icon: Package,
        sparkline: SparkBars,
      },
      {
        label: isArabic ? "الاشتراكات النشطة" : "Active subscriptions",
        value: "17",
        hint: isArabic ? "4 مجموعات نشطة" : "4 active groups",
        change: "+4.2%",
        positive: true,
        icon: CreditCard,
        sparkline: SparkLine,
      },
      {
        label: isArabic ? "تنتهي هذا الأسبوع" : "Expiring this week",
        value: "0",
        hint: isArabic ? "لا يحتاج تجديد" : "No renewals due",
        change: "0%",
        positive: true,
        icon: CalendarDays,
        sparkline: SparkBars,
      },
    ],
    products: [
      {
        name: isArabic ? "بروتين" : "Protein",
        meta: "4,800",
        value: "EGP 8,886",
      },
      {
        name: isArabic ? "مشروبات الطاقة" : "Energy drinks",
        meta: "400",
        value: "EGP 8,886",
      },
      {
        name: isArabic ? "المكملات" : "Supplements",
        meta: "370",
        value: "EGP 8,886",
      },
    ],
    stock: [
      {
        name: isArabic ? "زجاجات المياه" : "Water bottles",
        meta: "17",
        value: isArabic ? "6 كراتين" : "6 boxes",
        danger: true,
      },
      {
        name: isArabic ? "أشرطة المقاومة" : "Resistance bands",
        meta: "17",
        value: isArabic ? "5 كراتين" : "5 boxes",
        danger: true,
      },
      {
        name: isArabic ? "مقابض العقلة" : "Pull-up grips",
        meta: "4",
        value: isArabic ? "0 كراتين" : "0 boxes",
        danger: true,
      },
    ],
    timeline: [
      {
        time: "10:38 PM",
        title: isArabic ? "إضافة عضو جديد" : "New member added",
        detail: isArabic
          ? "تمت إضافة عضو جديد إلى النظام"
          : "A new member was added to the system",
      },
      {
        time: "10:30 PM",
        title: isArabic ? "تسجيل حضور" : "Attendance recorded",
        detail: isArabic
          ? "تم تسجيل حضور عضو جديد"
          : "A member check-in was recorded",
      },
      {
        time: "10:23 PM",
        title: isArabic ? "مدفوعات" : "Payment received",
        detail: isArabic
          ? "تم تسجيل دفعة اشتراك"
          : "A subscription payment was captured",
      },
    ],
  };
}
