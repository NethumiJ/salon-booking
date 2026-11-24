const MAP: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  completed: "bg-sky-100 text-sky-800",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-zinc-200 text-zinc-700",
};

export default function StatusChip({ status }: { status: string }) {
  return <span className={`chip ${MAP[status] ?? "bg-zinc-100"}`}>{status.replace("_", " ")}</span>;
}
