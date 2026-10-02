import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
}

/** The page title. The h1 takes programmatic focus (`tabIndex={-1}`) when a view changes in place. */
export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-1 pb-2">
      <h1 tabIndex={-1} className="text-3xl font-extrabold tracking-tight text-ink outline-none">{title}</h1>
      {subtitle ? <p className="text-base text-ink-muted">{subtitle}</p> : null}
    </header>
  );
}
