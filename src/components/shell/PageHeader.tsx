import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-1 pb-2">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
      {subtitle ? <p className="text-base text-ink-muted">{subtitle}</p> : null}
    </header>
  );
}
