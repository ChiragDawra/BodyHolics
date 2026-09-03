import { CheckCircleIcon } from "@/components/ui/icons";

/**
 * A tight checklist: circled tick, text, small vertical rhythm.
 *
 * Deliberately renders nothing when handed an empty list. The gym types its
 * own plan benefits in Gym settings, and a plan nobody has described yet
 * should show no section at all rather than a heading over a placeholder.
 */
export function CheckList({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null;

  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5">
          <CheckCircleIcon
            className="mt-px h-4 w-4 flex-none text-brand"
            strokeWidth={1.8}
          />
          <span className="text-sm leading-snug text-ink">{item}</span>
        </li>
      ))}
    </ul>
  );
}
