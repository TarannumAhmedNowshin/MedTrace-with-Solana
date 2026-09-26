// Tiny hash router that backs the next/link + next/navigation shims in the preview.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface RouterState { path: string; search: URLSearchParams; nav(to: string, replace?: boolean): void; refreshKey: number; refresh(): void }
const Ctx = createContext<RouterState | null>(null);

const parse = () => {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [path, q = ""] = raw.split("?");
  return { path: path || "/", search: new URLSearchParams(q) };
};

export function HashRouter({ children }: { children: ReactNode }) {
  const [loc, setLoc] = useState(parse);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const on = () => setLoc(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const nav = (to: string, replace = false) => {
    const url = `#${to}`;
    if (replace) { history.replaceState(null, "", url); setLoc(parse()); }
    else { window.location.hash = to; }
    if (!replace) window.scrollTo(0, 0);
  };
  return <Ctx.Provider value={{ ...loc, nav, refreshKey, refresh: () => setRefreshKey((k) => k + 1) }}>{children}</Ctx.Provider>;
}

export function useRouterState() {
  const c = useContext(Ctx);
  if (!c) throw new Error("HashRouter missing");
  return c;
}
