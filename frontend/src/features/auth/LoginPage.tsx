import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Eye, EyeOff, Loader2, LockKeyhole, Moon, ShieldCheck, Sparkles, Sun, Timer, User } from "lucide-react";
import { BrandMark } from "@/components/layout/Sidebar";
import { BRAND } from "@/components/layout/nav";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/hooks/useTheme";
import { ApiError } from "@/services/api";
import { useAuth } from "./useAuth";

const schema = z.object({
  username: z.string().trim().min(1, "Username is required").max(64),
  password: z.string().min(1, "Password is required").max(128),
});
type Values = z.infer<typeof schema>;

const FEATURES = [
  { icon: LockKeyhole, title: "Secure access", text: "Every request is checked against your account." },
  { icon: Timer, title: "Real-time claim tracking", text: "Follow each claim from filing to settlement." },
  { icon: Sparkles, title: "AI assistant, available 24×7", text: "Ask about cover, renewals and payments any time." },
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const { theme, toggle } = useTheme();
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { username: "", password: "" } });

  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/"} replace />;

  const onSubmit = async (v: Values) => {
    setError(null);
    try {
      const u = await login(v.username, v.password);
      const from = (loc.state as { from?: string } | null)?.from;
      const ok = from && (from.startsWith("/admin") ? u.role === "admin" : u.role === "customer");
      nav(ok ? from : u.role === "admin" ? "/admin" : "/", { replace: true });
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? "Invalid username or password." : e instanceof Error ? e.message : "Sign in failed.");
    }
  };

  return (
    <main className="grid h-dvh overflow-hidden bg-background lg:grid-cols-2">
      <section className="brand-panel relative hidden flex-col justify-between overflow-hidden p-12 text-brand-fg lg:flex" aria-label="About">
        <div className="dot-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-fg/15"><ShieldCheck className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden /></div>
          <span className="text-section">{BRAND}</span>
        </div>
        <div className="relative max-w-lg space-y-8">
          <div className="space-y-3">
            <h1 className="text-display">Your policies, claims and payments in one place</h1>
            <p className="text-base text-brand-fg/80">Manage your cover, track claims and pay premiums, with an assistant to help along the way.</p>
          </div>
          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-fg/15"><Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden /></span>
                <span><span className="block text-sm font-medium">{title}</span><span className="block text-sm text-brand-fg/75">{text}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-brand-fg/70">© 2026 {BRAND}</p>
      </section>

      <section className="relative flex min-h-0 flex-col overflow-y-auto bg-background" aria-label="Sign in">
        <div className="flex items-center justify-between p-4 sm:px-6">
          <div className="flex items-center gap-2.5 lg:invisible"><BrandMark /><span className="text-section">{BRAND}</span></div>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>{theme === "dark" ? <Sun /> : <Moon />}</Button>
        </div>
        <div className="mx-auto flex w-full flex-1 flex-col justify-center px-4 pb-8 sm:max-w-[440px]">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><LockKeyhole className="h-5 w-5" strokeWidth={1.75} aria-hidden /></span>
              <h2 className="text-title">Sign in</h2>
            </div>
            <p className="mt-1 text-sm text-text-secondary">Welcome back. Enter your credentials to continue.</p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate autoComplete="off">
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" strokeWidth={1.75} aria-hidden />
                  <Input id="username" data-testid="login-username" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="Enter your username" className="h-10 pl-9"
                    aria-invalid={!!errors.username} aria-describedby={errors.username ? "username-err" : undefined} {...register("username")} />
                </div>
                {errors.username && <p id="username-err" className="text-xs text-danger">{errors.username.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" strokeWidth={1.75} aria-hidden />
                  <Input id="password" data-testid="login-password" type={show ? "text" : "password"} autoComplete="new-password" placeholder="Enter your password" className="h-10 pl-9 pr-10"
                    aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-err" : undefined} {...register("password")} />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff /> : <Eye />}</Button>
                </div>
                {errors.password && <p id="password-err" className="text-xs text-danger">{errors.password.message}</p>}
              </div>
              {error && <Alert variant="destructive" data-testid="login-error"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
              <Button type="submit" data-testid="login-submit" className="h-10 w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin" />}{isSubmitting ? "Signing in…" : "Sign in"}</Button>
            </form>
          </div>
          <p className="mt-8 flex items-center gap-1.5 text-xs text-text-muted"><ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />Secure, encrypted sign-in</p>
        </div>
      </section>
    </main>
  );
}
