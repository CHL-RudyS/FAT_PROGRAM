"use client";

export function Spinner({ size = 15, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg className="spin" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style={{ flex: "none" }}>
      <circle cx="8" cy="8" r="6.5" fill="none" stroke={color} strokeOpacity=".25" strokeWidth="2.2" />
      <path d="M8 1.5A6.5 6.5 0 0 1 14.5 8" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Covers the screen it sits in while a navigation runs. The screens that use
 * it hand off to a server-rendered page, so they stay on display for a moment
 * after the click — without this they look idle at exactly the wrong time.
 */
export default function LoadingOverlay({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 80,
        display: "grid",
        placeItems: "center",
        background: "rgba(234,243,248,.5)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 11,
          padding: "14px 22px",
          borderRadius: 13,
          background: "rgba(255,255,255,.92)",
          border: "1px solid var(--rule)",
          boxShadow: "0 18px 40px -20px rgba(22,32,27,.4)",
          fontSize: 13.5,
          color: "var(--ink2)",
        }}
      >
        <Spinner size={18} color="var(--ledger)" />
        {label}
      </div>
    </div>
  );
}
