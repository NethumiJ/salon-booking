"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeRegistration, requestOtp, verifyOtp } from "@/actions/customer";

export default function CustomerLogin({ slug, next }: { slug: string; next: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp" | "name">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [devCode, setDevCode] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const finish = () => { router.replace(next); router.refresh(); };

  function send() {
    setError("");
    start(async () => {
      const r = await requestOtp(slug, phone);
      if (!r.ok) return setError(r.error);
      setDevCode(r.devCode); setStep("otp");
    });
  }

  return (
    <div className="card mx-auto max-w-sm space-y-4">
      {step === "phone" && (
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="space-y-4">
          <div>
            <h1 className="text-xl font-bold">Sign in to book</h1>
            <p className="text-sm text-muted">We’ll send a 6-digit code to your WhatsApp.</p>
          </div>
          <label className="block"><span className="label">Mobile number</span>
            <input className="input" inputMode="tel" autoComplete="tel" placeholder="07X XXX XXXX" value={phone} onChange={(e) => setPhone(e.target.value)} required autoFocus />
          </label>
          <button className="btn btn-brand w-full" disabled={pending}>{pending ? "Sending…" : "Send code on WhatsApp"}</button>
        </form>
      )}
      {step === "otp" && (
        <form onSubmit={(e) => { e.preventDefault(); setError(""); start(async () => {
          const r = await verifyOtp(slug, phone, code);
          if (!r.ok) return setError(r.error);
          if (r.next === "name") { setToken(r.token!); setStep("name"); } else finish();
        }); }} className="space-y-4">
          <div><h1 className="text-xl font-bold">Enter your code</h1><p className="text-sm text-muted">Sent to {phone}</p></div>
          {devCode && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Demo mode — your code is <b>{devCode}</b></p>}
          <input className="input text-center text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}"
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required autoFocus aria-label="6-digit code" />
          <button className="btn btn-brand w-full" disabled={pending || code.length !== 6}>{pending ? "Checking…" : "Verify"}</button>
          <button type="button" className="w-full text-xs text-muted underline" onClick={() => { setStep("phone"); setCode(""); setError(""); }}>Use a different number</button>
        </form>
      )}
      {step === "name" && (
        <form onSubmit={(e) => { e.preventDefault(); setError(""); start(async () => {
          const r = await completeRegistration(slug, token, name);
          if (!r.ok) return setError(r.error);
          finish();
        }); }} className="space-y-4">
          <div><h1 className="text-xl font-bold">Welcome!</h1><p className="text-sm text-muted">First visit here — what should we call you?</p></div>
          <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoComplete="name" autoFocus />
          <button className="btn btn-brand w-full" disabled={pending}>{pending ? "Saving…" : "Continue"}</button>
        </form>
      )}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
