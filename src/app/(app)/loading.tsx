/**
 * Shown the moment a module link is clicked, while the screen's queries run.
 * Its presence also lets Next.js prefetch each route's shell on hover, so the
 * shell and header appear immediately instead of after the round trip.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Memuat layar">
      <div className="head">
        <div>
          <div className="sk" style={{ width: 260, height: 26 }} />
          <div className="sk" style={{ width: 340, height: 14, marginTop: 9 }} />
        </div>
        <div className="head-act">
          <div className="sk" style={{ width: 96, height: 32, borderRadius: 8 }} />
          <div className="sk" style={{ width: 120, height: 32, borderRadius: 8 }} />
        </div>
      </div>

      <div className="metrics">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="metric">
            <div className="sk" style={{ width: "62%", height: 12, margin: "0 auto" }} />
            <div className="sk" style={{ width: "80%", height: 28, margin: "9px auto 0" }} />
            <div className="sk" style={{ width: "46%", height: 12, margin: "6px auto 0" }} />
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-h">
          <div className="sk" style={{ width: 180, height: 16 }} />
          <div className="rt">
            <div className="sk" style={{ width: 110, height: 26, borderRadius: 7 }} />
          </div>
        </div>
        <div className="card-b">
          {[0, 1, 2, 3, 4, 5, 6].map((index) => (
            <div
              key={index}
              style={{
                display: "flex",
                gap: 16,
                alignItems: "center",
                padding: "11px 0",
                borderBottom: index === 6 ? "none" : "1px solid var(--rule)",
              }}
            >
              <div className="sk" style={{ width: 72, height: 13, flex: "none" }} />
              <div className="sk" style={{ height: 13, flex: 1 }} />
              <div className="sk" style={{ width: 96, height: 13, flex: "none" }} />
              <div className="sk" style={{ width: 64, height: 13, flex: "none" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
