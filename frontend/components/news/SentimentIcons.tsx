// Solid shapes for sentiment (▲ ▼ ●), sized by className like lucide icons.

type IconProps = { className?: string };

export function TriangleUp({ className }: IconProps) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" className={className}>
      <path d="M5 1.5 9.2 8.5H.8z" fill="currentColor" />
    </svg>
  );
}

export function TriangleDown({ className }: IconProps) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" className={className}>
      <path d="M5 8.5 .8 1.5h8.4z" fill="currentColor" />
    </svg>
  );
}

export function Circle({ className }: IconProps) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" className={className}>
      <circle cx="5" cy="5" r="3.5" fill="currentColor" />
    </svg>
  );
}
