"use client";

import { useState } from "react";
import { PinPad } from "./PinPad";
import { CheckDashboard } from "./CheckDashboard";

/**
 * The whole /check app.
 *
 * The PIN is held here in React state and passed down to the dashboard, which
 * sends it with every RPC call so the server re-verifies on each request.
 * Nothing is persisted: a reload or a closed tab drops straight back to the
 * lock screen.
 */
export function CheckApp() {
  const [pin, setPin] = useState<string | null>(null);

  if (pin === null) return <PinPad onUnlock={setPin} />;

  return <CheckDashboard pin={pin} onLock={() => setPin(null)} />;
}
