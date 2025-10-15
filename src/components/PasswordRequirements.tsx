import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordRequirementsProps {
  password: string;
  className?: string;
}

export const PasswordRequirements = ({ password, className }: PasswordRequirementsProps) => {
  const requirements = useMemo(() => [
    { label: "At least 12 characters", met: password.length >= 12 },
    { label: "Contains uppercase letter (A-Z)", met: /[A-Z]/.test(password) },
    { label: "Contains lowercase letter (a-z)", met: /[a-z]/.test(password) },
    { label: "Contains number (0-9)", met: /[0-9]/.test(password) },
    { label: "Contains special character (@$!%*?&)", met: /[@$!%*?&]/.test(password) }
  ], [password]);

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium text-muted-foreground">Password Requirements:</p>
      <ul className="space-y-1" role="list">
        {requirements.map((req, index) => (
          <li key={index} className="flex items-center gap-2 text-sm">
            {req.met ? (
              <Check className="h-4 w-4 text-success flex-shrink-0" aria-hidden="true" />
            ) : (
              <X className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
            )}
            <span className={cn(
              req.met ? "text-foreground" : "text-muted-foreground"
            )}>
              {req.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
