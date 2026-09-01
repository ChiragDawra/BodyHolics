import { Button } from "@/components/ui/Button";
import { LogOutIcon } from "@/components/ui/icons";

/**
 * A form POST rather than a click handler, so signing out works with
 * JavaScript disabled and cannot be triggered by a prefetch.
 */
export function SignOutButton({
  label,
  fullWidth = true,
  variant = "button",
}: {
  label: string;
  fullWidth?: boolean;
  /** "link" is the quiet footer treatment: text only, no chrome. */
  variant?: "button" | "link";
}) {
  if (variant === "link") {
    return (
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="font-body text-sm font-medium text-ink-dim transition-colors hover:text-ink-muted"
        >
          {label}
        </button>
      </form>
    );
  }

  return (
    <form action="/auth/signout" method="post">
      <Button type="submit" variant="secondary" fullWidth={fullWidth}>
        <LogOutIcon className="h-5 w-5" />
        {label}
      </Button>
    </form>
  );
}
