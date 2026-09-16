"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/i18n/LocaleProvider";
import { BackdropWaves } from "@/components/shell/icons";
import { SETUP_ICONS } from "./SetupIcons";
import { MONTHS_ID } from "@/lib/format";

const VALUES: Array<[string, string]> = [
  ["L", "Living with Integrity"],
  ["E", "Encourage Assertiveness & Professionalism"],
  ["S", "Strong Commitment"],
  ["T", "Teamwork with Loyalty"],
  ["A", "Achieve Services Level Agreements"],
  ["R", "Reliable Worth Ethic"],
  ["I", "Internal Harmony and Solidarity"],
];

export default function SetupScreen({ user }: { user: { name: string; roleName: string } }) {
  const t = useT();
  const [hovered, setHovered] = useState<number | null>(null);
  const [stamp, setStamp] = useState("");

  // The prototype keeps this stamp on the system clock, refreshed every 30s.
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      setStamp(`Login ${now.getDate()} ${MONTHS_ID[now.getMonth()]} ${now.getFullYear()} · ${hh}:${mm} WIB`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "linear-gradient(180deg,#FDFDFD 0%,#F1F4F9 55%,#DEE3EC 100%)",
        padding: "60px 22px 22px",
        overflowY: "auto",
      }}
    >
      <BackdropWaves />

      <div
        style={{
          background: "var(--card)",
          borderRadius: 14,
          boxShadow: "0 6px 20px rgba(22,32,27,.12)",
          padding: "26px 24px",
          display: "grid",
          gridTemplateColumns: "max-content minmax(0,1fr)",
          width: "min(789px,100%)",
          margin: "0 auto",
          gap: 26,
          alignItems: "start",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: ".08em", color: "var(--ledger)", textTransform: "uppercase", fontWeight: 600 }}>
            Internal System
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, flexWrap: "nowrap" }}>
            <Image src="/assets/logo-chl.png" alt="Logo PT. Cipta Harmoni Lestari" width={40} height={38} style={{ height: 38, width: "auto", display: "block", flex: "none" }} priority />
            <span style={{ fontSize: 23, fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.15, color: "#C79A2E", whiteSpace: "nowrap" }}>
              CIPTA HARMONI LESTARI
            </span>
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "var(--ink2)", textTransform: "uppercase" }}>
              Company Values
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 12 }}>
              {VALUES.map(([initial, text]) => (
                <div key={initial} style={{ display: "grid", gridTemplateColumns: "18px 1fr", alignItems: "baseline", columnGap: 8 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 14, fontWeight: 600, color: "var(--ledger)" }}>{initial}</span>
                  <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--ink2)" }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ borderLeft: "1px solid rgba(22,32,27,.10)", paddingLeft: 24, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: "var(--ink3)" }}>{t("Selamat Datang Kembali :")}</div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: "-.02em",
              lineHeight: 1.2,
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              overflow: "hidden",
              marginTop: 6,
              textTransform: "uppercase",
              color: "var(--ink)",
            }}
          >
            {user.name}
          </div>
          <div className="num" style={{ fontSize: 13, color: "var(--ledger-dk)", marginTop: 5, textTransform: "uppercase" }}>
            {t(user.roleName)}
          </div>
          <div style={{ width: 52, height: 3, background: "var(--ledger)", borderRadius: 2, marginTop: 14 }} />
          <p style={{ fontSize: 13.5, color: "var(--ink2)", marginTop: 14, maxWidth: 420, textWrap: "pretty" }}>
            {t("Pilih Modul untuk Memulai Perusahaan dan Pekerjaan yang Terotomatisasi.")}
          </p>
          <div className="num" style={{ fontSize: 11.5, color: "var(--ink4)", marginTop: 14 }}>
            {stamp}
          </div>
        </div>

        <div
          style={{
            gridColumn: "1/-1",
            width: 0,
            minWidth: "100%",
            marginTop: 25,
            display: "flex",
            flexDirection: "column",
            gap: 0,
            borderRadius: 12,
            overflow: "visible",
            background: "linear-gradient(180deg,rgba(207,224,236,.10) 0%,rgba(207,224,236,.30) 55%,rgba(207,224,236,.44) 100%)",
          }}
        >
          <div style={{ background: "transparent", padding: "5px 28px 12px", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 0, padding: 0 }}>
              {SETUP_ICONS.map(({ label, href, Art }, index) => {
                const isHovered = hovered === index;
                return (
                  <Link
                    key={label}
                    href={href}
                    aria-label={t(label)}
                    onMouseEnter={() => setHovered(index)}
                    onMouseLeave={() => setHovered((current) => (current === index ? null : current))}
                    onFocus={() => setHovered(index)}
                    onBlur={() => setHovered((current) => (current === index ? null : current))}
                    style={{
                      flex: "none",
                      width: 100,
                      height: 114,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      position: "relative",
                      background: "transparent",
                    }}
                  >
                    <Art hovered={isHovered} />
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 20,
                        height: 7,
                        borderRadius: 4,
                        background: isHovered ? "var(--ledger)" : "var(--rule)",
                        boxShadow: isHovered ? "0 0 10px 2px rgba(46,134,171,.55)" : "none",
                        transition: "background .16s,box-shadow .16s",
                      }}
                    />
                  </Link>
                );
              })}
            </div>

            <div
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                letterSpacing: "-.01em",
                color: "var(--ink2)",
                marginTop: 24,
                textAlign: "center",
                opacity: hovered === null ? 0 : 1,
                transition: "opacity .14s",
                minHeight: "1.4em",
              }}
            >
              {hovered === null ? " " : t(SETUP_ICONS[hovered].label)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
