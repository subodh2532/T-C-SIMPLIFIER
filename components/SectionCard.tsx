type SectionCardProps = {
  title: string;
  tone?: "default" | "risk";
  items: string[];
};

export function SectionCard({
  title,
  tone = "default",
  items
}: SectionCardProps) {
  const toneClasses =
    tone === "risk"
      ? "border-rose-200 bg-white/95"
      : "border-white/70 bg-white/90";

  return (
    <section className={`rounded-[28px] border p-6 shadow-[0_16px_45px_rgba(15,23,42,0.08)] ${toneClasses}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            tone === "risk" ? "bg-rose-500" : "bg-blue-500"
          }`}
        />
      </div>
      <ul className="space-y-3">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
            <span className="mt-2 h-2 w-2 rounded-full bg-current opacity-70" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
