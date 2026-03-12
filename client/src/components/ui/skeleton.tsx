import { cn } from "./utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "bg-[var(--brand-light)]ccent animate-pulse rounded-md",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
