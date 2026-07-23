import { cn } from "@/lib/projekty/utils";

const PALETTE = [
  "#0EA5E9", "#14B8A6", "#22C55E", "#F59E0B",
  "#EF4444", "#EC4899", "#8B5CF6", "#6366F1",
] as const;

export type UserAvatarProps = {
  user: {
    id: number;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
};

const SIZE_PX: Record<NonNullable<UserAvatarProps["size"]>, number> = {
  xs: 20,
  sm: 28,
  md: 40,
  lg: 64,
};

export function UserAvatar({ user, size = "md", className }: UserAvatarProps) {
  const px = SIZE_PX[size];
  const display = user.name?.trim() || user.email || String(user.id);

  if (user.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.image}
        alt={display}
        width={px}
        height={px}
        loading="lazy"
        className={cn("rounded-full object-cover", className)}
        style={{ width: px, height: px }}
      />
    );
  }

  const initials = getInitials(user.name, user.email);
  const bg = PALETTE[djb2(String(user.id)) % PALETTE.length];
  const fontPx = Math.max(9, Math.round(px * 0.42));

  return (
    <div
      aria-label={display}
      title={display}
      className={cn(
        "inline-flex select-none items-center justify-center rounded-full font-semibold text-white",
        className,
      )}
      style={{ width: px, height: px, backgroundColor: bg, fontSize: fontPx }}
    >
      {initials}
    </div>
  );
}

function getInitials(name: string | null, email: string | null): string {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
  }
  if (email) {
    const local = email.split("@")[0] ?? "";
    return local.slice(0, 2).toUpperCase();
  }
  return "?";
}

function djb2(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}
