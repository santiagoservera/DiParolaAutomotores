import { useEffect } from "react";

export function ScrollRestoration({ page }: { page: string }) {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);

  return null;
}
