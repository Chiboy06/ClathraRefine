"use client";
import { useEffect } from "react";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function SSOCallbackPage() {
  const { handleRedirectCallback } = useClerk();
  const router = useRouter();

  useEffect(() => {
    handleRedirectCallback({}).catch(() => router.push("/sign-in"));
  }, [handleRedirectCallback, router]);

  return null;
}
