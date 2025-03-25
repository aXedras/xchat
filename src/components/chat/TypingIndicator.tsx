
import React from "react";
import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
  name: string;
  className?: string;
}

const TypingIndicator = ({ name, className }: TypingIndicatorProps) => {
  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground italic px-3 py-2", className)}>
      <div className="flex gap-1">
        <span className="animate-bounce delay-0 h-1.5 w-1.5 bg-primary/70 rounded-full" />
        <span className="animate-bounce delay-100 h-1.5 w-1.5 bg-primary/70 rounded-full" />
        <span className="animate-bounce delay-200 h-1.5 w-1.5 bg-primary/70 rounded-full" />
      </div>
      <span>{name} is typing...</span>
    </div>
  );
};

export default TypingIndicator;
