/** Metric tiles (`.metrics` / `.metric`) shown above module tables. */

export type Metric = {
  label: string;
  value: string;
  delta?: string;
  deltaColor?: string;
};

export function Metrics({ items }: { items: Metric[] }) {
  return (
    <div className="metrics">
      {items.map((item) => (
        <div key={item.label} className="metric">
          <div className="l">{item.label}</div>
          <div className="v">{item.value}</div>
          {item.delta && (
            <div className="d" style={{ color: item.deltaColor ?? "var(--ink3)" }}>
              {item.delta}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Horizontal icon + figure tile used by the Vendor and Customer screens. */
export function StatTile({
  icon,
  value,
  label,
  background,
  color,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  background: string;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 13,
        background: "var(--card)",
        border: "1px solid var(--rule)",
        borderRadius: 12,
        padding: "15px 17px",
        minWidth: 0,
      }}
    >
      <span style={{ width: 38, height: 38, borderRadius: 10, background, color, display: "grid", placeItems: "center", flex: "none" }}>
        {icon}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 19, fontWeight: 600, letterSpacing: "-.02em", color: "var(--ink)", fontFamily: "var(--mono)" }}>
          {value}
        </span>
        <span style={{ display: "block", fontSize: 11.5, color: "var(--ink3)", marginTop: 1 }}>{label}</span>
      </span>
    </div>
  );
}

export function StatTileRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14, marginBottom: 16 }}>
      {children}
    </div>
  );
}
