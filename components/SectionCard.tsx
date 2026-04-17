type SectionCardProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <section className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-[0_18px_48px_rgba(18,33,26,0.08)] backdrop-blur">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
        {description ? <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
