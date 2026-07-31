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
      className="grid grid-cols-5 gap-1 rounded-lg border border-border bg-popover p-2 shadow-lg"
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
          className={`grid size-8 place-items-center rounded text-lg transition-colors hover:bg-accent ${
            emoji === current ? "ring-2 ring-blue-500" : ""
          }`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
