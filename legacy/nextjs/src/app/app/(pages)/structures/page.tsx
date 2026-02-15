"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function StructuresPageRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("view", "structures");
    const queryString = params.toString();
    router.replace(`/app/repertoire${queryString ? `?${queryString}` : ""}`, { scroll: false });
  }, [router, searchParams]);

  return null;
}
