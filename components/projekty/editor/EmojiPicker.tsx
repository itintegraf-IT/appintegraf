"use client";

const EMOJIS = [
  "💡", "⚠️", "✅", "❌", "ℹ️",
  "📝", "🔥", "🚨", "🎯", "⭐",
  "🎉", "💼", "📅", "💰", "📊",
  "🔧", "🐛", "🚀", "💬", "📌",
  "🔒", "📁", "📎", "🏷️", "❓",
  "👍", "👎", "🤔", "✨", "📈",
];

export function EmojiPicker({
  current,
  onSelect,
  onClose,
}: {
  current: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label="Vybrat emoji"
      className="grid grid-cols-5 gap-1 rounded-lg border border-[hsl(var(--notion-fg)/0.12)] bg-[hsl(var(--notion-canvas))] p-2 shadow-lg"
    >
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => {
            onSelect(emoji);
            onClose();
          }}
          aria-label={`Emoji ${emoji}`}
          className={`grid size-8 place-items-center rounded text-lg transition-colors hover:bg-[hsl(var(--notion-fg)/0.06)] ${
            emoji === current ? "ring-2 ring-[hsl(var(--info))]" : ""
          }`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
