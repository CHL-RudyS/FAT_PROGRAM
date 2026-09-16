"use client";

import { useEffect } from "react";

/** Modal shell matching the prototype's `.mdl` overlay. */
export default function Dialog({
  open,
  title,
  badge,
  badgeTone = "open",
  maxWidth = 580,
  onClose,
  footer,
  children,
}: {
  open: boolean;
  title: string;
  badge?: string;
  /** Matches the prototype's chip variants on dialog headers. */
  badgeTone?: "open" | "warn" | "info" | "lock" | "bad" | "ok";
  maxWidth?: number;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        display: "flex",
        position: "fixed",
        inset: 0,
        zIndex: 92,
        background: "rgba(22,32,27,.42)",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth,
          maxHeight: "88vh",
          overflow: "auto",
          background: "var(--card)",
          borderRadius: 14,
          boxShadow: "0 20px 50px rgba(22,32,27,.28)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--rule)" }}>
          <h2 style={{ fontSize: 14, fontWeight: 600 }}>{title}</h2>
          {badge && (
            <span className={`chip chip-${badgeTone}`} style={{ marginLeft: "auto" }}>
              {badge}
            </span>
          )}
          <button
            onClick={onClose}
            aria-label="Tutup"
            style={{ color: "var(--ink3)", padding: "2px 6px", fontSize: 14, marginLeft: badge ? 0 : "auto" }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: "16px 18px 8px" }}>{children}</div>
        {footer && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 18px 16px", borderTop: "1px solid var(--rule)", marginTop: 8 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
