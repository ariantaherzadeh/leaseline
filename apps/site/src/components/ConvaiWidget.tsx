"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

// ElevenLabs' embeddable widget: the floating call + chat bubble in the corner. It's a custom
// element, so React only renders the tag; the script defines it.
declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "elevenlabs-convai": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        "agent-id": string;
      };
    }
  }
}

export type ClientTools = Record<string, (params: Record<string, unknown>) => string>;

type ConvaiCallEvent = CustomEvent<{ config: { clientTools?: ClientTools } }>;

/** Press the widget's own "Start call" button (the embed has no public start method). */
export function startWidgetCall() {
  const widget = document.querySelector("elevenlabs-convai");
  const button = [...(widget?.shadowRoot?.querySelectorAll("button") ?? [])].find((b) =>
    /start (a )?call/i.test(b.getAttribute("aria-label") || b.textContent || ""),
  );
  button?.click();
}

export function ConvaiWidget({
  agentId,
  clientTools,
  onCallStart,
}: {
  agentId: string;
  clientTools: ClientTools;
  onCallStart?: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  // Keep the latest handlers without re-registering the listener on every render.
  const tools = useRef(clientTools);
  const onStart = useRef(onCallStart);
  useEffect(() => {
    tools.current = clientTools;
    onStart.current = onCallStart;
  });

  useEffect(() => {
    const widget = ref.current;
    if (!widget) return;
    // Fired when a call starts: hand the widget our client tools for this conversation.
    const onCall = (event: Event) => {
      onStart.current?.();
      (event as ConvaiCallEvent).detail.config.clientTools = Object.fromEntries(
        Object.keys(tools.current).map((name) => [
          name,
          (params: Record<string, unknown>) => tools.current[name](params ?? {}),
        ]),
      );
    };
    widget.addEventListener("elevenlabs-convai:call", onCall);
    return () => widget.removeEventListener("elevenlabs-convai:call", onCall);
  }, []);

  return (
    <>
      <elevenlabs-convai ref={ref} agent-id={agentId} />
      <Script src="https://unpkg.com/@elevenlabs/convai-widget-embed" strategy="afterInteractive" />
    </>
  );
}
