import type { AnchorHTMLAttributes, ReactNode } from "react";
import { useRouterState } from "./router";
export default function Link({ href, children, ...rest }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const r = useRouterState();
  return (
    <a {...rest} href={`#${href}`} onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); r.nav(href); }}>
      {children}
    </a>
  );
}
