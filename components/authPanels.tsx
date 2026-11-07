"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SignIn, SignUp } from "@clerk/nextjs";
import { LogIn } from "lucide-react";
import { DEMO_USERS } from "@/lib/demoData";
import { Button, ErrorNote, Notice, postJson } from "./ui";

const appearance = { variables: { colorPrimary: "#2563eb", fontFamily: "var(--font-inter)", borderRadius: "0.375rem" } };

export function ClerkSignIn() {
  return <SignIn appearance={appearance} forceRedirectUrl="/dashboard" />;
}
export function ClerkSignUp() {
  return <SignUp appearance={appearance} forceRedirectUrl="/welcome" />;
}

/** Demo quick-login: local runs and tests only. The server refuses it whenever Clerk is configured. */
export function DemoQuickLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const go = async (id: string) => {
    setBusy(id);
    setErr("");
    try {
      await postJson("/api/demo-login", { userId: id });
      const next = params.get("next");
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      {params.get("reason") === "idle" && <Notice tone="warn">You were signed out after 30 minutes without activity.</Notice>}
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {DEMO_USERS.map((u) => (
          <li key={u.id}>
            <Button className="w-full justify-between" busy={busy === u.id} onClick={() => go(u.id)} data-testid={`login-${u.id}`}>
              <span className="text-left">
                <span className="block font-semibold">{u.name}</span>
                <span className="block text-xs font-normal text-muted">{u.role}</span>
              </span>
              <LogIn aria-hidden className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
      {err && <ErrorNote>{err}</ErrorNote>}
    </div>
  );
}
