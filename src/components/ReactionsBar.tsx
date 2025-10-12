import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus } from "lucide-react";
import EmojiPicker from "./EmojiPicker";

interface Reaction {
  emoji: string;
  count: number;
  user_ids: string[];
  current_user_reacted: boolean;
}

interface ReactionsBarProps {
  reactions: Reaction[];
  onReact: (emoji: string) => void;
}

export default function ReactionsBar({ reactions, onReact }: ReactionsBarProps) {
  const [showPicker, setShowPicker] = useState(false);

  if (reactions.length === 0) {
    return (
      <div className="flex gap-1 mt-2">
        <Popover open={showPicker} onOpenChange={setShowPicker}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs hover:bg-muted"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add reaction
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <EmojiPicker
              onEmojiSelect={(emoji) => {
                onReact(emoji);
                setShowPicker(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {reactions.map((reaction) => (
        <TooltipProvider key={reaction.emoji}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={reaction.current_user_reacted ? "secondary" : "outline"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onReact(reaction.emoji)}
              >
                <span className="mr-1">{reaction.emoji}</span>
                <span className="text-muted-foreground">{reaction.count}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                {reaction.count} {reaction.count === 1 ? "reaction" : "reactions"}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}

      <Popover open={showPicker} onOpenChange={setShowPicker}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-muted"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <EmojiPicker
            onEmojiSelect={(emoji) => {
              onReact(emoji);
              setShowPicker(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
