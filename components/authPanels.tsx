"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { DEMO_USERS } from "@/lib/demoData";
import { Button, ErrorNote, Notice, postJson } from "./ui";
import { Mark } from "./mark";

function PasswordInput({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        className="w-full rounded-lg border border-line bg-elev px-3 py-2.5 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-8 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.18)]">
      <div className="mb-6 flex flex-col items-center gap-3">
        <Mark className="h-10 w-10" />
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-center text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

const fieldCls = "w-full rounded-lg border border-line bg-elev px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

function clerkErr(e: unknown): string {
  return (e as { errors?: { message: string }[] })?.errors?.[0]?.message
    ?? (e as { message?: string })?.message
    ?? "Something went wrong. Please try again.";
}

/** Custom Clerk sign-in using the Clerk 7 Future API. */
export function ClerkSignIn() {
  const { signIn } = useSignIn();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const googleSignIn = async () => {
    if (!signIn) return;
    setBusy(true);
    setErr("");
    try {
      await signIn.sso({ strategy: "oauth_google", redirectUrl: "/app", redirectCallbackUrl: "/sso-callback" });
    } catch (e) {
      setErr(clerkErr(e));
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!signIn) return;
    setBusy(true);
    setErr("");
    try {
      // Clerk 7: create sets the identifier, then password() submits the credential
      const { error: createErr } = await signIn.create({ identifier: email });
      if (createErr) { setErr(createErr.message); return; }

      const { error: pwErr } = await signIn.password({ password });
      if (pwErr) { setErr(pwErr.message); return; }

      if (signIn.status === "complete") {
        const { error: finalErr } = await signIn.finalize();
        if (finalErr) { setErr(finalErr.message); return; }
        const next = params.get("next");
        router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/app");
      } else {
        setErr("Additional verification required. Please check your email.");
      }
    } catch (e) {
      setErr(clerkErr(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Sign in to ClathraRefine">
      {params.get("reason") === "idle" && <Notice tone="warn">You were signed out after 30 minutes without activity.</Notice>}
      <button
        type="button"
        onClick={googleSignIn}
        disabled={busy || !signIn}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-elev px-4 py-2.5 text-sm font-medium hover:bg-elev/80 disabled:opacity-50"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="si-email" className="text-sm font-medium">Email address</label>
          <input id="si-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required placeholder="you@company.com" className={fieldCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="si-password" className="text-sm font-medium">Password</label>
          <PasswordInput id="si-password" value={password} onChange={setPassword} autoComplete="current-password" />
        </div>
        {err && <ErrorNote>{err}</ErrorNote>}
        <button
          type="submit"
          disabled={busy || !signIn}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          Sign in
        </button>
        <p className="text-center text-sm text-muted">
          No account?{" "}
          <Link href="/sign-up" className="font-semibold text-primary-fg hover:underline">Create one</Link>
        </p>
      </form>
    </AuthCard>
  );
}

/** Custom Clerk sign-up using the Clerk 7 Future API. */
export function ClerkSignUp() {
  const { signUp } = useSignUp();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"form" | "verify">("form");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const googleSignUp = async () => {
    if (!signUp) return;
    setBusy(true);
    setErr("");
    try {
      await signUp.sso({ strategy: "oauth_google", redirectUrl: "/app/get-started", redirectCallbackUrl: "/sso-callback" });
    } catch (e) {
      setErr(clerkErr(e));
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!signUp) return;
    setBusy(true);
    setErr("");
    try {
      // Clerk 7: password() creates the account and sets all fields at once
      const { error: pwErr } = await signUp.password({ firstName, lastName, emailAddress: email, password });
      if (pwErr) { setErr(pwErr.message); return; }
      // Send email verification code
      const { error: sendErr } = await signUp.verifications.sendEmailCode();
      if (sendErr) { setErr(sendErr.message); return; }
      setStage("verify");
    } catch (e) {
      setErr(clerkErr(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (!signUp) return;
    setBusy(true);
    setErr("");
    try {
      const { error: verifyErr } = await signUp.verifications.verifyEmailCode({ code });
      if (verifyErr) { setErr(verifyErr.message); return; }

      if (signUp.status === "complete") {
        const { error: finalErr } = await signUp.finalize();
        if (finalErr) { setErr(finalErr.message); return; }
        router.push("/app/get-started");
      } else {
        setErr("Verification incomplete. Please try again.");
      }
    } catch (e) {
      setErr(clerkErr(e));
    } finally {
      setBusy(false);
    }
  };

  if (stage === "verify") {
    return (
      <AuthCard title="Verify your email" subtitle={`We sent a 6-digit code to ${email}. Enter it below.`}>
        <form onSubmit={verify} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="su-code" className="text-sm font-medium">Verification code</label>
            <input
              id="su-code"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              required
              placeholder="123456"
              className={fieldCls + " font-mono tracking-widest text-center text-lg"}
            />
          </div>
          {err && <ErrorNote>{err}</ErrorNote>}
          <button
            type="submit"
            disabled={busy || !signUp}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Verify and continue
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your account" subtitle="New accounts start as viewer. After sign-up you set up your organisation and request a role.">
      <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={googleSignUp}
        disabled={busy || !signUp}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-elev px-4 py-2.5 text-sm font-medium hover:bg-elev/80 disabled:opacity-50"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="su-first" className="text-sm font-medium">First name</label>
            <input id="su-first" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" className={fieldCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="su-last" className="text-sm font-medium">Last name</label>
            <input id="su-last" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" className={fieldCls} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="su-email" className="text-sm font-medium">Work email</label>
          <input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@company.com" className={fieldCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="su-password" className="text-sm font-medium">Password</label>
          <PasswordInput id="su-password" value={password} onChange={setPassword} autoComplete="new-password" />
          <p className="text-xs text-muted">At least 8 characters.</p>
        </div>
        {err && <ErrorNote>{err}</ErrorNote>}
        <button
          type="submit"
          disabled={busy || !signUp}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Create account
        </button>
        <p className="text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-semibold text-primary-fg hover:underline">Sign in</Link>
        </p>
      </form>
      </div>
    </AuthCard>
  );
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
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/app");
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

/** Finishes a Google sign-in or sign-up redirect, then Clerk sends the user on. */
export function SsoCallback() {
  const { handleRedirectCallback } = useClerk();
  const router = useRouter();
  useEffect(() => {
    handleRedirectCallback({}).catch(() => router.push("/sign-in"));
  }, [handleRedirectCallback, router]);
  return null;
}
