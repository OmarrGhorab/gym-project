"use client";

import { ArrowUpRight, Banknote, CreditCard, Landmark } from "lucide-react";
import { useTranslations } from "next-intl";
import { Bar, BarChart, LabelList, type LabelProps, XAxis, YAxis } from "recharts";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";

import type { PosPaymentMethod } from "./data";
import { formatEgp } from "./format";

const icons = {
  bank_transfer: Landmark,
  card: CreditCard,
  cash: Banknote,
} as const;

const trafficSourcesConfig = {
  percentage: {
    label: "Share",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

type IconLabelProps = {
  height?: number | string;
  index?: number;
  width?: number | string;
  x?: number | string;
  y?: number | string;
};

type SourceLabelProps = LabelProps & {
  index?: number;
};

type SourceChangeLabelProps = LabelProps & {
  value?: number | string;
};

function getNumber(value: number | string | undefined) {
  return typeof value === "number" ? value : Number(value);
}

function PaymentIconLabel({ data, height, index, width, x, y }: IconLabelProps & { data: PosPaymentMethod[] }) {
  if (typeof index !== "number") {
    return null;
  }

  const source = data[index];
  const Icon = icons[source?.method as keyof typeof icons] ?? Banknote;
  const xValue = getNumber(x);
  const yValue = getNumber(y);
  const widthValue = getNumber(width);
  const heightValue = getNumber(height);

  if (
    !source ||
    Number.isNaN(xValue) ||
    Number.isNaN(yValue) ||
    Number.isNaN(widthValue) ||
    Number.isNaN(heightValue)
  ) {
    return null;
  }

  const iconSize = 16;
  const iconX = Math.max(xValue + 10, xValue + widthValue - iconSize - 10);
  const iconY = yValue + (heightValue - iconSize) / 2;

  return (
    <foreignObject height={iconSize} x={iconX} y={iconY} width={iconSize}>
      <Icon className="size-4 text-foreground" />
    </foreignObject>
  );
}

function PaymentNameLabel({ data, height, index, y }: SourceLabelProps & { data: PosPaymentMethod[] }) {
  if (typeof index !== "number") {
    return null;
  }

  const source = data[index];
  const yValue = getNumber(y);
  const heightValue = getNumber(height);

  if (!source || Number.isNaN(yValue) || Number.isNaN(heightValue)) {
    return null;
  }

  return (
    <foreignObject height={heightValue} width={126} x={0} y={yValue}>
      <div className="flex h-full min-w-0 items-center overflow-hidden leading-none">
        <div className="truncate font-medium text-[13px] text-foreground">{source.label}</div>
      </div>
    </foreignObject>
  );
}

function PaymentDetailLabel({ data, height, index, width, x, y }: IconLabelProps & { data: PosPaymentMethod[] }) {
  if (typeof index !== "number") {
    return null;
  }

  const source = data[index];
  const xValue = getNumber(x);
  const yValue = getNumber(y);
  const widthValue = getNumber(width);
  const heightValue = getNumber(height);

  if (
    !source ||
    Number.isNaN(xValue) ||
    Number.isNaN(yValue) ||
    Number.isNaN(widthValue) ||
    Number.isNaN(heightValue)
  ) {
    return null;
  }

  return (
    <foreignObject height={18} width={Math.max(widthValue, 220)} x={xValue} y={yValue + heightValue + 3}>
      <div className="whitespace-nowrap text-muted-foreground text-xs leading-none">
        {formatEgp(source.amount)} · {source.count} orders
      </div>
    </foreignObject>
  );
}

function PaymentShareLabel({ height, value, y }: SourceChangeLabelProps) {
  const yValue = getNumber(y);
  const heightValue = getNumber(height);

  if (Number.isNaN(yValue) || Number.isNaN(heightValue)) {
    return null;
  }

  return (
    <text
      className="fill-green-700 dark:fill-green-300"
      dominantBaseline="middle"
      dx={-6}
      fontSize={13}
      textAnchor="end"
      x="100%"
      y={yValue + heightValue / 2}
    >
      {String(value ?? "0")}%
    </text>
  );
}

export function TrafficSources({ methods }: { methods: PosPaymentMethod[] }) {
  const t = useTranslations("Dashboard.ecommerce");
  const total = methods.reduce((sum, method) => sum + method.count, 0);
  const chartData = methods.map((method) => ({
    ...method,
    percentage: Number(method.percentage),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">{t("paymentMethods")}</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {t("paidOrders", { count: total })}
        </CardDescription>
        <CardAction>
          <ArrowUpRight className="size-4" />
        </CardAction>
      </CardHeader>

      <CardContent>
        <ChartContainer config={trafficSourcesConfig} className="h-60 w-full">
          <BarChart
            accessibilityLayer
            barCategoryGap={24}
            data={chartData}
            layout="vertical"
            margin={{ bottom: 16, left: 136, right: 50, top: 0 }}
          >
            <XAxis dataKey="percentage" domain={[0, 100]} hide type="number" />
            <YAxis dataKey="label" hide type="category" />
            <Bar
              background={{ fill: "var(--muted)", radius: 8 }}
              barSize={36}
              dataKey="percentage"
              fill="var(--color-percentage)"
              fillOpacity={0.5}
              name={t("share")}
              radius={8}
            >
              <LabelList content={(props) => <PaymentNameLabel {...props} data={methods} />} dataKey="label" />
              <LabelList content={(props) => <PaymentIconLabel {...props} data={methods} />} dataKey="percentage" />
              <LabelList content={(props) => <PaymentDetailLabel {...props} data={methods} />} dataKey="percentage" />
              <LabelList content={<PaymentShareLabel />} dataKey="percentage" />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
