import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../src/components/ui/breadcrumb-3.tsx", import.meta.url),
  "utf8"
);

const itemBlocks = source.match(/<BreadcrumbItem[\s\S]*?<\/BreadcrumbItem>/g) ?? [];
const separatorInsideItem = itemBlocks.some((block) =>
  block.includes("<BreadcrumbSeparator")
);

if (separatorInsideItem) {
  console.error(
    "BreadcrumbSeparator renders as <li> and must not be nested inside BreadcrumbItem."
  );
  process.exit(1);
}

const listCloseIndex = source.indexOf("</BreadcrumbList>");
const dateLabelIndex = source.indexOf("dateLabel ? (");

if (dateLabelIndex !== -1 && dateLabelIndex < listCloseIndex) {
  console.error(
    "dateLabel should be rendered outside BreadcrumbList so it is not treated as a breadcrumb segment."
  );
  process.exit(1);
}

console.log("Breadcrumb markup check passed.");
