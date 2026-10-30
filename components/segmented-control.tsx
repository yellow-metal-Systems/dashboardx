"use client";

import { cn } from "@/lib/utils";

type Option<T extends string> = { value: T; label: string };

/**
 * A row of pills where exactly one is chosen (an ARIA radio group): Tab enters
 * on the chosen pill, the arrow keys move the choice, as screen-reader users expect.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
  itemClassName,
}: {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
  itemClassName?: string;
}) {
  const current = Math.max(0, options.findIndex((o) => o.value === value));

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, i: number) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = (i + step + options.length) % options.length;
    onChange(options[next].value);
    (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} className={cn("flex gap-1 rounded-full bg-surface-container-low p-1", className)}>
      {options.map((o, i) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={i === current ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "rounded-full text-sm font-bold transition-[background-color,color,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              checked ? "bg-raised text-on-surface shadow-e1" : "text-on-surface-variant hover:text-on-surface",
              itemClassName
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
