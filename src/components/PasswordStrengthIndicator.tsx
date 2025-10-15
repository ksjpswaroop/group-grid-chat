import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

export const PasswordStrengthIndicator = ({ password, className }: PasswordStrengthIndicatorProps) => {
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: "None", color: "bg-muted" };

    let score = 0;
    
    // Length check
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    
    // Character variety checks
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[@$!%*?&]/.test(password)) score += 1;

    if (score <= 2) return { score: 25, label: "Weak", color: "bg-destructive" };
    if (score <= 4) return { score: 50, label: "Medium", color: "bg-warning" };
    if (score <= 5) return { score: 75, label: "Good", color: "bg-success" };
    return { score: 100, label: "Strong", color: "bg-success" };
  }, [password]);

  if (!password) return null;

  return (
    <div className={cn("space-y-2", className)} role="status" aria-live="polite">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Password Strength:</span>
        <span className={cn("font-medium", {
          "text-destructive": strength.label === "Weak",
          "text-warning": strength.label === "Medium",
          "text-success": strength.label === "Good" || strength.label === "Strong"
        })}>
          {strength.label}
        </span>
      </div>
      <Progress value={strength.score} className={cn("h-2", "[&>div]:transition-colors", {
        "[&>div]:bg-destructive": strength.label === "Weak",
        "[&>div]:bg-warning": strength.label === "Medium",
        "[&>div]:bg-success": strength.label === "Good" || strength.label === "Strong"
      })} />
    </div>
  );
};
