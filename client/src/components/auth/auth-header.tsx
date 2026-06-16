"use client";

export type AuthHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export function AuthHeader({ eyebrow, title, description }: AuthHeaderProps) {
  return (
    <div className="space-y-3">
      {eyebrow && (
        <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
      )}
      <div className="space-y-2">
        <h2 className="text-4xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="text-sm leading-7 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
