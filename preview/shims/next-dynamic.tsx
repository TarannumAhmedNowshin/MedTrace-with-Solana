import { lazy, Suspense, type ComponentType } from "react";
export default function dynamic<P extends object>(loader: () => Promise<ComponentType<P>>, _opts?: unknown) {
  const L = lazy(async () => ({ default: await loader() }));
  return (props: P) => <Suspense fallback={null}><L {...props} /></Suspense>;
}
