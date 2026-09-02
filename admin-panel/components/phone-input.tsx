"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatPhoneInput } from "@/lib/phone-format";

type PhoneInputProps = Omit<React.ComponentProps<typeof Input>, "type" | "inputMode"> & {
  placeholder?: string;
};

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  function PhoneInput({ className, onChange, placeholder, ...props }, ref) {
    return (
      <Input
        ref={ref}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={placeholder}
        className={cn(className)}
        onChange={(e) => {
          const formatted = formatPhoneInput(e.target.value);
          e.target.value = formatted;
          onChange?.(e);
        }}
        {...props}
      />
    );
  }
);

export { PhoneInput };
