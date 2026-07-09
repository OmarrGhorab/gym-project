"use client";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getErrorCode, getFieldErrors, getFriendlyError, login } from "@/lib/auth";
import { firstAccessibleDashboardPath } from "@/lib/authorization";

export function LoginForm() {
  const router = useRouter();
  const tCommon = useTranslations("Auth.common");
  const tLogin = useTranslations("Auth.login");
  const formSchema = z.object({
    email: z.string().email({ message: tCommon("invalidEmail") }),
    password: z.string().min(6, { message: tCommon("passwordTooShort") }),
    remember: z.boolean().optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      remember: false,
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      const result = await login(data);
      router.replace(firstAccessibleDashboardPath({ permissions: result.data.user.permissions ?? [] }));
    } catch (error) {
      if (getErrorCode(error) === "email_not_verified") {
        router.push(`/auth/v2/verify-email?email=${encodeURIComponent(data.email)}`);
        return;
      }

      const fieldErrors = getFieldErrors(error);

      if (fieldErrors) {
        for (const [name, message] of Object.entries(fieldErrors)) {
          form.setError(name as keyof z.infer<typeof formSchema>, { message });
        }
      }

      toast.error(tLogin("failed"), {
        description: getFriendlyError(error),
      });
    }
  };

  return (
    <form noValidate method="POST" onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FieldGroup className="gap-4">
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="login-email">{tCommon("emailAddress")}</FieldLabel>
              <Input
                {...field}
                id="login-email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="login-password">{tCommon("password")}</FieldLabel>
              <Input
                {...field}
                id="login-password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="remember"
          render={({ field, fieldState }) => (
            <Field orientation="horizontal" data-invalid={fieldState.invalid}>
              <Checkbox
                id="login-remember"
                name={field.name}
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                aria-invalid={fieldState.invalid}
              />
              <FieldContent>
                <FieldLabel htmlFor="login-remember" className="font-normal">
                  {tLogin("remember")}
                </FieldLabel>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </FieldContent>
            </Field>
          )}
        />
      </FieldGroup>
      <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? tLogin("submitting") : tCommon("login")}
      </Button>
    </form>
  );
}
