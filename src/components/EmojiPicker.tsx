import { Button } from "@/components/ui/button";

const commonEmojis = [
  "👍", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👏",
  "✅", "⭐", "💯", "🚀", "👀", "💪", "🙏", "💡"
];

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

export default function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  return (
    <div className="p-2 grid grid-cols-8 gap-1">
      {commonEmojis.map((emoji) => (
        <Button
          key={emoji}
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-muted text-lg"
          onClick={() => onEmojiSelect(emoji)}
        >
          {emoji}
        </Button>
      ))}
    </div>
  );
}
