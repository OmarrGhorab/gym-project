"use client";

import Image from "next/image";

import { PackageSearch } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { getProductImageSrc, type InventoryProduct } from "./shipment-data";

export function ProductImage({ product, size = "lg" }: { product: InventoryProduct | null; size?: "lg" | "sm" }) {
  const t = useTranslations("Dashboard.logistics");
  const src = getProductImageSrc(product);
  const className = size === "lg" ? "size-16 rounded-xl" : "size-10 rounded-lg";

  return (
    <div className={cn("relative grid shrink-0 place-items-center overflow-hidden border bg-muted", className)}>
      {src ? (
        <Image
          src={src}
          alt={product?.name ?? t("product")}
          fill
          className="object-cover"
          sizes={size === "lg" ? "64px" : "40px"}
        />
      ) : (
        <PackageSearch className="size-5 text-muted-foreground" />
      )}
    </div>
  );
}
