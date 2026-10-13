"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function PaymentRefresh() {
  const router = useRouter();
  useEffect(() => {
    let attempts = 0;
    const timer = setInterval(() => {
      router.refresh();
      if (++attempts >= 20) clearInterval(timer);
    }, 3000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
