import { useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { ROLES } from "@/lib/data";
import { Btn, Field } from "./common";

export function Login() {
  const s = useStore();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const [forgot, setForgot] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) er.email = "Enter a valid institutional email.";
    if (!forgot && pw.length < 6) er.pw = "Password must be at least 6 characters.";
    const u = s.users.find((x) => x.email === email.toLowerCase());
    if (!er.email && !forgot && !u) er.email = "No demo account with this email. Use a demo account below.";
    if (u?.status === "Deactivated") er.email = "This account is deactivated.";
    setErr(er);
    if (Object.keys(er).length) return;
    if (forgot) { setErr({ ok: "If the account exists, a reset link would be sent. (Not available in demo mode.)" }); return; }
    s.login(u!);
  };
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2 text-sidebar-accent-foreground"><ShieldCheck className="size-6" /><span className="font-semibold">All India Council for Technical Education</span></div>
        <div><h1 className="text-3xl font-semibold leading-tight text-sidebar-accent-foreground">Integrated Institution Complaint<br />Monitoring & Status Dashboard</h1>
          <p className="mt-3 max-w-md text-sm">Consolidated institution histories, cross-bureau overlap review, and accountable case movement for authorised AICTE officials.</p></div>
        <p className="text-xs">Restricted system. Access is logged and monitored.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <div><h2 className="text-xl font-semibold">{forgot ? "Reset password" : "Sign in"}</h2><p className="text-xs text-muted-foreground">Use your AICTE institutional account.</p></div>
          <Field label="Email" error={err.email}><input className="field w-full" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@aicte-demo.in" /></Field>
          {!forgot && <Field label="Password" error={err.pw}><div className="relative"><input type={show ? "text" : "password"} className="field w-full pr-9" value={pw} onChange={(e) => setPw(e.target.value)} />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-2 text-muted-foreground" aria-label="Toggle password">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></Field>}
          {err.ok && <p className="rounded bg-success/10 p-2 text-xs text-success">{err.ok}</p>}
          <Btn v="primary" type="submit" className="h-9 w-full justify-center">{forgot ? "Send reset link" : "Sign in"}</Btn>
          <button type="button" onClick={() => { setForgot(!forgot); setErr({}); }} className="text-xs text-primary hover:underline">{forgot ? "Back to sign in" : "Forgot password?"}</button>
          {import.meta.env.DEV && (
            <div className="rounded border border-dashed border-warning bg-warning/10 p-3">
              <p className="mb-2 text-[11px] font-semibold">Development demo accounts (mock authentication)</p>
              <div className="grid grid-cols-2 gap-1">
                {ROLES.map((r) => { const u = s.users.find((x) => x.role === r && x.status === "Active")!; return <button key={r} type="button" onClick={() => s.login(u)} className="rounded border bg-card px-2 py-1 text-left text-[11px] hover:border-primary">{r}</button>; })}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
