type LogoProps = {
  size?: number;
  className?: string;
};

export default function Logo({ size = 24, className }: LogoProps) {
  // Two facing arcs forming "( )" - two people in conversation with deliberate space between them.
  // Each arc is roughly 3/4 of a circle, opening toward the other.
  // Stroke width scales with size. Gap between arcs is roughly 30% of total width.
  const stroke = Math.max(1.5, size / 12);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Left arc: opens to the right, ~3/4 circle */}
      <path d="M 18 9 A 12 14 0 1 0 18 39" />
      {/* Right arc: opens to the left, ~3/4 circle */}
      <path d="M 30 9 A 12 14 0 1 1 30 39" />
    </svg>
  );
}
