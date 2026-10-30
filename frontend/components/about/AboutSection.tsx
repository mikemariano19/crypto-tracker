/**
 * One About page section: an anchor (`/about#privacy`) with an <h2>.
 * `scroll-mt` keeps the heading clear of the sticky nav bar when jumped to.
 */
export default function AboutSection({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20">
      <h2 id={`${id}-title`} className="text-xl font-bold tracking-tight">
        {title}
      </h2>
      {intro && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{intro}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
