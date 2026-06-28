import Link from "next/link";

import { useTranslations } from "next-intl";
import { siGoogle } from "simple-icons";

import { SimpleIcon } from "@/components/simple-icon";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GoogleButtonProps = React.ComponentProps<typeof Button> & {
  href?: string;
};

export function GoogleButton({ className, href, ...props }: GoogleButtonProps) {
  const t = useTranslations("Auth.login");

  if (href) {
    return (
      <Link className={cn(buttonVariants({ variant: "secondary" }), "w-full", className)} href={href} prefetch={false}>
        <SimpleIcon icon={siGoogle} className="size-4" />
        {t("google")}
      </Link>
    );
  }

  return (
    <Button variant="secondary" className={cn("w-full", className)} {...props}>
      <SimpleIcon icon={siGoogle} className="size-4" />
      {t("google")}
    </Button>
  );
}
