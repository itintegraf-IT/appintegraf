"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  id: number;
  title: string;
  message: string | null;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export function NotificationLink({ id, title, message, link, readAt, createdAt }: Props) {
  const router = useRouter();

  const handleClick = async () => {
    if (!readAt) {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      router.refresh();
    }
  };

  return (
    <Link
      href={link ?? "/"}
      onClick={handleClick}
      className={`flex flex-col gap-0.5 rounded-lg border px-4 py-3 transition-colors hover:bg-gray-50 ${
        !readAt ? "border-blue-200 bg-blue-50/50" : "border-gray-100"
      }`}
    >
      <p className="font-medium text-gray-900">{title}</p>
      {message && (
        <p className="text-sm text-gray-600 line-clamp-2">{message}</p>
      )}
      <p className="text-xs text-gray-500">
        {new Date(createdAt).toLocaleDateString("cs-CZ", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </Link>
  );
}
