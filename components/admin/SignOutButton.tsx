import { Button } from "@/components/ui/Button";
import { LogOutIcon } from "@/components/ui/icons";

/**
 * A form POST rather than a click handler, so signing out works with
 * JavaScript disabled and cannot be triggered by a prefetch.
 */
export function SignOutButton({
  label,
  fullWidth = true,
}: {
  label: string;
  fullWidth?: boolean;
}) {
  return (
    <form action="/auth/signout" method="post">
      <Button type="submit" variant="secondary" fullWidth={fullWidth}>
        <LogOutIcon className="h-5 w-5" />
        {label}
      </Button>
    </form>
  );
}
