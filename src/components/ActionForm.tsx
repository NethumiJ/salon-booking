"use client";
import { createContext, useContext, useRef, useState, useTransition } from "react";
import type { State } from "@/lib/validation";

const Pending = createContext(false);

/**
 * Form wrapper for server actions. Uses onSubmit (not <form action>) so fields are NOT wiped when validation fails.
 * Pass `reset` to clear the form after success.
 */
export default function ActionForm({
  action, children, className, reset = false, confirm,
}: {
  action: (prev: State, fd: FormData) => Promise<State>;
  children: React.ReactNode;
  className?: string;
  reset?: boolean;
  confirm?: string;
}) {
  const [state, setState] = useState<State>({});
  const [pending, start] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await action(state, fd);
          setState(res ?? {});
          if (res?.ok && reset) ref.current?.reset();
        });
      }}
    >
      <Pending.Provider value={pending}>{children}</Pending.Provider>
      {state.error && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.ok && state.message && <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.message}</p>}
    </form>
  );
}

export function Submit({ children, className = "btn btn-brand" }: { children: React.ReactNode; className?: string }) {
  const pending = useContext(Pending);
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Please wait…" : children}
    </button>
  );
}
