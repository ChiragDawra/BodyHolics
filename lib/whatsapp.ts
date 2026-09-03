import "server-only";
import { createClient } from "@/lib/supabase/server";
import { strings } from "@/lib/strings";

/**
 * The one place a WhatsApp provider plugs in.
 *
 * WhatsApp Business messaging needs a verified Meta Business Account and a
 * dedicated number, neither of which exists yet. Rather than pretend, every
 * message is written to `whatsapp_messages` as `queued` and left there. The
 * admin can see exactly that, because a fake "Sent" toast over a message that
 * went nowhere is worse than no feature at all.
 *
 * When a provider is connected — Meta Cloud API, or a BSP — the only thing
 * that changes is `deliver()` below: it posts each message, then updates the
 * row to `sent` with a `sent_at`, or `failed` with an `error`. Every caller,
 * every button, and every template stays exactly as it is.
 */

export type WhatsAppType = "fee_reminder" | "invoice" | "alert";

export type WhatsAppPayload = {
  fee_reminder: { amountPaise: number };
  invoice: { amountPaise: number; planName: string; endsOn: string };
  alert: { title: string; body: string };
};

type Draft = {
  gym_id: string;
  member_id: string;
  phone: string;
  type: WhatsAppType;
  body: string;
  created_by: string | null;
};

/** What each kind of message actually says. */
function compose<T extends WhatsAppType>(
  type: T,
  payload: WhatsAppPayload[T],
  gymName: string,
): string {
  const t = strings.whatsapp;

  switch (type) {
    case "fee_reminder": {
      const p = payload as WhatsAppPayload["fee_reminder"];
      return t.feeReminder(gymName, strings.common.rupees(p.amountPaise));
    }
    case "invoice": {
      const p = payload as WhatsAppPayload["invoice"];
      return t.invoice(
        gymName,
        strings.common.rupees(p.amountPaise),
        p.planName,
        p.endsOn,
      );
    }
    default: {
      const p = payload as WhatsAppPayload["alert"];
      return t.alert(gymName, p.title, p.body);
    }
  }
}

/**
 * THE SEAM.
 *
 * Today: write the rows as `queued` and log. Tomorrow: also hand them to a
 * provider and record what it said. Nothing above this line needs to know
 * which of those is happening.
 */
async function deliver(drafts: Draft[]): Promise<number> {
  if (drafts.length === 0) return 0;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .insert(drafts)
    .select("id");

  if (error) {
    console.error("[whatsapp] could not queue messages:", error.message);
    return 0;
  }

  console.info(
    `[whatsapp] queued ${data?.length ?? 0} message(s) of type ` +
      `${drafts[0]!.type}. No provider is connected, so they stay queued.`,
  );

  return data?.length ?? 0;
}

async function gymName(gymId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gyms")
    .select("name")
    .eq("id", gymId)
    .maybeSingle();

  return data?.name ?? strings.app.name;
}

async function staffId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Queue one message to one member.
 *
 * Returns false when the member has no phone number, which is not an error —
 * plenty of walk-in records do not have one, and the caller should say so
 * rather than report a send that could never happen.
 */
export async function sendWhatsAppMessage<T extends WhatsAppType>(
  memberId: string,
  type: T,
  payload: WhatsAppPayload[T],
): Promise<boolean> {
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("profiles")
    .select("id, gym_id, phone")
    .eq("id", memberId)
    .maybeSingle();

  if (!member?.phone) return false;

  const queued = await deliver([
    {
      gym_id: member.gym_id,
      member_id: member.id,
      phone: member.phone,
      type,
      body: compose(type, payload, await gymName(member.gym_id)),
      created_by: await staffId(),
    },
  ]);

  return queued > 0;
}

/**
 * Queue the same alert to everyone at the gym who has a phone number.
 *
 * Goes through the same `deliver()` as a single message, so connecting a
 * provider fixes both at once. Members without a number are skipped and
 * counted, because "reached 28 of 32" is the honest report.
 */
export async function broadcastWhatsAppAlert(
  gymId: string,
  payload: WhatsAppPayload["alert"],
): Promise<{ queued: number; skipped: number }> {
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("profiles")
    .select("id, phone")
    .eq("gym_id", gymId);

  const all = members ?? [];
  const reachable = all.filter((m): m is { id: string; phone: string } =>
    Boolean(m.phone),
  );

  const body = compose("alert", payload, await gymName(gymId));
  const author = await staffId();

  const queued = await deliver(
    reachable.map((m) => ({
      gym_id: gymId,
      member_id: m.id,
      phone: m.phone,
      type: "alert" as const,
      body,
      created_by: author,
    })),
  );

  return { queued, skipped: all.length - reachable.length };
}
