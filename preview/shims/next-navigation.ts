import { useRouterState } from "./router";
export const usePathname = () => useRouterState().path;
export const useSearchParams = () => useRouterState().search;
export function useRouter() {
  const r = useRouterState();
  return { push: (to: string) => r.nav(to), replace: (to: string, _o?: unknown) => r.nav(to, true), refresh: () => r.refresh(), back: () => history.back() };
}
