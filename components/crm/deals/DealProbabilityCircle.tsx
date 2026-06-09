import { cn } from "@/lib/utils";

type Props = {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  className?: string;
};

export function DealProbabilityCircle({
  value,
  size = 32,
  strokeWidth = 3,
  className,
}: Props) {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const colorClass =
    clamped >= 70 ? "stroke-emerald-500" :
    clamped >= 40 ? "stroke-sky-500" :
    "stroke-muted-foreground";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("-rotate-90", className)}
      aria-label={`Pravděpodobnost ${clamped} %`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        className="stroke-muted/40 fill-none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className={cn("fill-none transition-[stroke-dashoffset] duration-300 ease-out", colorClass)}
      />
    </svg>
  );
}
