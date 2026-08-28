"use client";

import * as React from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PasswordStrengthLevel = 0 | 1 | 2 | 3 | 4;

export function getPasswordStrength(password: string): {
  level: PasswordStrengthLevel;
  label: string;
} {
  if (!password) return { level: 0, label: "" };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 1, label: "Weak" };
  if (score === 2) return { level: 2, label: "Fair" };
  if (score === 3) return { level: 3, label: "Good" };
  return { level: 4, label: "Strong" };
}

const strengthBarClass: Record<PasswordStrengthLevel, string> = {
  0: "w-0 bg-muted",
  1: "w-1/4 bg-destructive",
  2: "w-2/4 bg-orange-500",
  3: "w-3/4 bg-amber-500",
  4: "w-full bg-emerald-500",
};

type PasswordInputProps = React.ComponentProps<typeof Input> & {
  showStrength?: boolean;
  strengthValue?: string;
};

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    { className, showStrength = false, strengthValue, ...props },
    ref
  ) {
    const [visible, setVisible] = React.useState(false);
    const strength = getPasswordStrength(strengthValue ?? "");
    const displayStrength = showStrength && (strengthValue ?? "").length > 0;

    return (
      <div className="space-y-2">
        <div className="relative">
          <Input
            ref={ref}
            type={visible ? "text" : "password"}
            className={cn("pr-9", className)}
            {...props}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </Button>
        </div>
        {displayStrength ? (
          <div className="space-y-1" aria-live="polite">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-200",
                  strengthBarClass[strength.level]
                )}
              />
            </div>
            <p className="text-xs text-muted-foreground">{strength.label}</p>
          </div>
        ) : null}
      </div>
    );
  }
);

export { PasswordInput };
