"use client";

/* Isometric 3D artwork for the Set Up screen, converted from the prototype
   (design/project/FAT PROGRAM.dc.html lines 502-640). Each icon floats on its own
   cycle; hovering pauses the float and lifts the art. */

function Icon0({ hovered }: { hovered: boolean }) {
  return (
    <>
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 11,
          width: 78,
          height: 78,
          borderRadius: "50%",
          background: "radial-gradient(closest-side,rgba(46,134,171,.55)",
          filter: "blur(6px)",
          animation: "entGlow 4.6s ease-in-out infinite",
        }}
      />
      <svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true" style={{ position: "relative", animation: "entFloat 4.6s ease-in-out infinite", transition: "transform .22s cubic-bezier(.2,.8,.3,1)", animationPlayState: hovered ? "paused" : "running", transform: hovered ? "translateY(-8px) scale(1.06)" : undefined }}>
                  <defs>
                    <linearGradient id="entTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8FC5DF"></stop><stop offset="1" stopColor="#5FA8C9"></stop></linearGradient>
                    <linearGradient id="entLeft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2E86AB"></stop><stop offset="1" stopColor="#1B4F6B"></stop></linearGradient>
                    <linearGradient id="entRight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1F6E90"></stop><stop offset="1" stopColor="#14384C"></stop></linearGradient>
                  </defs>
                  <ellipse cx="50" cy="86" rx="27" ry="6" fill="rgba(22,32,27,.14)"></ellipse>
                  <path d="M50 16 78 31 50 46 22 31Z" fill="url(#entTop)"></path>
                  <path d="M22 31 50 46 50 80 22 65Z" fill="url(#entLeft)"></path>
                  <path d="M78 31 78 65 50 80 50 46Z" fill="url(#entRight)"></path>
                  <g fill="rgba(255,255,255,.55)">
                    <path d="M29 41 35 44.3 35 50 29 46.7Z"></path><path d="M39 46.4 45 49.7 45 55.4 39 52.1Z"></path>
                    <path d="M29 52 35 55.3 35 61 29 57.7Z"></path><path d="M39 57.4 45 60.7 45 66.4 39 63.1Z"></path>
                  </g>
                  <g fill="rgba(255,255,255,.28)">
                    <path d="M56 49.7 62 46.4 62 52.1 56 55.4Z"></path><path d="M66 44.3 72 41 72 46.7 66 50Z"></path>
                    <path d="M56 60.7 62 57.4 62 63.1 56 66.4Z"></path><path d="M66 55.3 72 52 72 57.7 66 61Z"></path>
                  </g>
                </svg>
    </>
  );
}

function Icon1({ hovered }: { hovered: boolean }) {
  return (
    <>
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 11,
          width: 78,
          height: 78,
          borderRadius: "50%",
          background: "radial-gradient(closest-side,rgba(107,78,138,.5)",
          filter: "blur(6px)",
          animation: "entGlow 5.2s ease-in-out infinite",
        }}
      />
      <svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true" style={{ position: "relative", animation: "entFloat 5.2s ease-in-out infinite", transition: "transform .22s cubic-bezier(.2,.8,.3,1)", animationPlayState: hovered ? "paused" : "running", transform: hovered ? "translateY(-8px) scale(1.06)" : undefined }}>
                  <defs>
                    <linearGradient id="orgTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#BBA6D2"></stop><stop offset="1" stopColor="#8E74B0"></stop></linearGradient>
                    <linearGradient id="orgLeft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7A5C9E"></stop><stop offset="1" stopColor="#4E3868"></stop></linearGradient>
                    <linearGradient id="orgRight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5E4480"></stop><stop offset="1" stopColor="#382649"></stop></linearGradient>
                  </defs>
                  <ellipse cx="50" cy="86" rx="27" ry="6" fill="rgba(22,32,27,.14)"></ellipse>
                  <path d="M50 14 68 24 50 34 32 24Z" fill="url(#orgTop)"></path>
                  <path d="M32 24 50 34 50 48 32 38Z" fill="url(#orgLeft)"></path>
                  <path d="M68 24 68 38 50 48 50 34Z" fill="url(#orgRight)"></path>
                  <path d="M28 52 42 60 28 68 14 60Z" fill="url(#orgTop)"></path>
                  <path d="M14 60 28 68 28 79 14 71Z" fill="url(#orgLeft)"></path>
                  <path d="M42 60 42 71 28 79 28 68Z" fill="url(#orgRight)"></path>
                  <path d="M72 52 86 60 72 68 58 60Z" fill="url(#orgTop)"></path>
                  <path d="M58 60 72 68 72 79 58 71Z" fill="url(#orgLeft)"></path>
                  <path d="M86 60 86 71 72 79 72 68Z" fill="url(#orgRight)"></path>
                  <g stroke="rgba(46,56,73,.45)" strokeWidth="2" fill="none"><path d="M50 48 50 54 28 60"></path><path d="M50 54 72 60"></path></g>
                </svg>
    </>
  );
}

function Icon2({ hovered }: { hovered: boolean }) {
  return (
    <>
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 11,
          width: 78,
          height: 78,
          borderRadius: "50%",
          background: "radial-gradient(closest-side,rgba(27,79,107,.46)",
          filter: "blur(6px)",
          animation: "entGlow 5.0s ease-in-out infinite",
        }}
      />
      <svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true" style={{ position: "relative", animation: "entFloat 5.0s ease-in-out infinite", transition: "transform .22s cubic-bezier(.2,.8,.3,1)", animationPlayState: hovered ? "paused" : "running", transform: hovered ? "translateY(-8px) scale(1.06)" : undefined }}>
                  <defs>
                    <linearGradient id="unitTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#A8CFE2"></stop><stop offset="1" stopColor="#6FA9C4"></stop></linearGradient>
                    <linearGradient id="unitLeft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2E86AB"></stop><stop offset="1" stopColor="#1B4F6B"></stop></linearGradient>
                    <linearGradient id="unitRight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#20657F"></stop><stop offset="1" stopColor="#14384C"></stop></linearGradient>
                  </defs>
                  <ellipse cx="50" cy="86" rx="28" ry="6" fill="rgba(22,32,27,.14)"></ellipse>
                  <path d="M50 20 74 33 50 46 26 33Z" fill="url(#unitTop)"></path>
                  <path d="M26 33 50 46 50 58 26 45Z" fill="url(#unitLeft)"></path>
                  <path d="M74 33 74 45 50 58 50 46Z" fill="url(#unitRight)"></path>
                  <path d="M28 58 42 66 28 74 14 66Z" fill="url(#unitTop)" opacity=".95"></path>
                  <path d="M14 66 28 74 28 82 14 74Z" fill="url(#unitLeft)"></path>
                  <path d="M42 66 42 74 28 82 28 74Z" fill="url(#unitRight)"></path>
                  <path d="M72 58 86 66 72 74 58 66Z" fill="url(#unitTop)" opacity=".95"></path>
                  <path d="M58 66 72 74 72 82 58 74Z" fill="url(#unitLeft)"></path>
                  <path d="M86 66 86 74 72 82 72 74Z" fill="url(#unitRight)"></path>
                </svg>
    </>
  );
}

function Icon3({ hovered }: { hovered: boolean }) {
  return (
    <>
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 11,
          width: 78,
          height: 78,
          borderRadius: "50%",
          background: "radial-gradient(closest-side,rgba(60,122,84,.42)",
          filter: "blur(6px)",
          animation: "entGlow 5.4s ease-in-out infinite",
        }}
      />
      <svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true" style={{ position: "relative", animation: "entFloat 5.4s ease-in-out infinite", transition: "transform .22s cubic-bezier(.2,.8,.3,1)", animationPlayState: hovered ? "paused" : "running", transform: hovered ? "translateY(-8px) scale(1.06)" : undefined }}>
                  <defs>
                    <linearGradient id="coaTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#BFDCC7"></stop><stop offset="1" stopColor="#8FBE9E"></stop></linearGradient>
                    <linearGradient id="coaLeft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3C7A54"></stop><stop offset="1" stopColor="#245135"></stop></linearGradient>
                    <linearGradient id="coaRight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2E6543"></stop><stop offset="1" stopColor="#1A3B27"></stop></linearGradient>
                  </defs>
                  <ellipse cx="50" cy="86" rx="26" ry="6" fill="rgba(22,32,27,.14)"></ellipse>
                  <path d="M50 16 76 29 50 42 24 29Z" fill="url(#coaTop)"></path>
                  <path d="M24 29 50 42 50 50 24 37Z" fill="url(#coaLeft)"></path>
                  <path d="M76 29 76 37 50 50 50 42Z" fill="url(#coaRight)"></path>
                  <path d="M50 36 76 49 50 62 24 49Z" fill="url(#coaTop)"></path>
                  <path d="M24 49 50 62 50 70 24 57Z" fill="url(#coaLeft)"></path>
                  <path d="M76 49 76 57 50 70 50 62Z" fill="url(#coaRight)"></path>
                  <path d="M50 56 76 69 50 82 24 69Z" fill="url(#coaTop)"></path>
                  <path d="M24 69 50 82 50 90 24 77Z" fill="url(#coaLeft)"></path>
                  <path d="M76 69 76 77 50 90 50 82Z" fill="url(#coaRight)"></path>
                </svg>
    </>
  );
}

function Icon4({ hovered }: { hovered: boolean }) {
  return (
    <>
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 11,
          width: 78,
          height: 78,
          borderRadius: "50%",
          background: "radial-gradient(closest-side,rgba(138,93,20,.42)",
          filter: "blur(6px)",
          animation: "entGlow 5.8s ease-in-out infinite",
        }}
      />
      <svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true" style={{ position: "relative", animation: "entFloat 5.8s ease-in-out infinite", transition: "transform .22s cubic-bezier(.2,.8,.3,1)", animationPlayState: hovered ? "paused" : "running", transform: hovered ? "translateY(-8px) scale(1.06)" : undefined }}>
                  <defs>
                    <linearGradient id="usrTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E3C489"></stop><stop offset="1" stopColor="#C79A2E"></stop></linearGradient>
                    <linearGradient id="usrLeft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#B4871F"></stop><stop offset="1" stopColor="#7A5A12"></stop></linearGradient>
                    <linearGradient id="usrRight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8A5D14"></stop><stop offset="1" stopColor="#54390B"></stop></linearGradient>
                  </defs>
                  <ellipse cx="50" cy="86" rx="27" ry="6" fill="rgba(22,32,27,.14)"></ellipse>
                  <circle cx="50" cy="27" r="13" fill="url(#usrTop)"></circle>
                  <path d="M50 40c-12 0-21 7-21 16v8l21 12 21-12v-8c0-9-9-16-21-16Z" fill="url(#usrLeft)"></path>
                  <path d="M50 56 71 44v20L50 76Z" fill="url(#usrRight)" opacity=".9"></path>
                  <path d="M50 56 29 44v20l21 12Z" fill="url(#usrLeft)"></path>
                  <path d="M50 40c8 0 15 3 18.6 7.6L50 56l-18.6-8.4C35 43 42 40 50 40Z" fill="url(#usrTop)" opacity=".85"></path>
                  <g fill="none" stroke="rgba(255,255,255,.62)" strokeWidth="2.4" strokeLinecap="round"><path d="M43 64l4.5 4.5L58 58"></path></g>
                </svg>
    </>
  );
}

function Icon5({ hovered }: { hovered: boolean }) {
  return (
    <>
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 11,
          width: 78,
          height: 78,
          borderRadius: "50%",
          background: "radial-gradient(closest-side,rgba(90,98,110,.42)",
          filter: "blur(6px)",
          animation: "entGlow 5.6s ease-in-out infinite",
        }}
      />
      <svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true" style={{ position: "relative", animation: "entFloat 5.6s ease-in-out infinite", transition: "transform .22s cubic-bezier(.2,.8,.3,1)", animationPlayState: hovered ? "paused" : "running", transform: hovered ? "translateY(-8px) scale(1.06)" : undefined }}>
                  <defs>
                    <linearGradient id="tl3Steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F0F3F6"></stop><stop offset=".45" stopColor="#B9C2CC"></stop><stop offset="1" stopColor="#7C8793"></stop></linearGradient>
                    <linearGradient id="tl3Edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#98A2AE"></stop><stop offset="1" stopColor="#4A525B"></stop></linearGradient>
                    <linearGradient id="tl3Grip" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E0BC6A"></stop><stop offset=".5" stopColor="#C79A2E"></stop><stop offset="1" stopColor="#7A5212"></stop></linearGradient>
                    <linearGradient id="tl3Shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="rgba(255,255,255,.85)"></stop><stop offset="1" stopColor="rgba(255,255,255,0)"></stop></linearGradient>
                  </defs>
                  <ellipse cx="50" cy="85" rx="25" ry="6" fill="rgba(22,32,27,.16)"></ellipse>
                  <g transform="rotate(38 50 50)">
                    <rect x="44" y="52" width="12" height="26" rx="5" fill="url(#tl3Grip)"></rect>
                    <rect x="46.4" y="54" width="2.6" height="22" rx="1.3" fill="url(#tl3Shine)" opacity=".7"></rect>
                    <rect x="46.6" y="46" width="6.8" height="8" rx="1.6" fill="url(#tl3Edge)"></rect>
                    <rect x="47.4" y="22" width="5.2" height="25" rx="2" fill="url(#tl3Steel)"></rect>
                    <path d="M47.4 24.5 50 19l2.6 5.5Z" fill="url(#tl3Edge)"></path>
                    <rect x="48.2" y="23" width="1.5" height="23" fill="url(#tl3Shine)" opacity=".8"></rect>
                  </g>
                  <g transform="rotate(-34 50 50)">
                    <rect x="44" y="50" width="12" height="28" rx="5" fill="url(#tl3Grip)"></rect>
                    <rect x="46.4" y="52" width="2.6" height="24" rx="1.3" fill="url(#tl3Shine)" opacity=".7"></rect>
                    <rect x="46.8" y="34" width="6.4" height="18" rx="2" fill="url(#tl3Steel)"></rect>
                    <path d="M50 15c6.4 0 11.2 4.6 11.2 10.4 0 4.2-2.6 7.4-6.6 9.2h-9.2c-4-1.8-6.6-5-6.6-9.2C38.8 19.6 43.6 15 50 15Z" fill="url(#tl3Steel)"></path>
                    <circle cx="50" cy="25.2" r="5.2" fill="#EDF1F4"></circle>
                    <circle cx="50" cy="25.2" r="5.2" fill="none" stroke="url(#tl3Edge)" strokeWidth="1.6"></circle>
                    <path d="M41.5 17.5c2-1.6 4.6-2.6 7.3-2.6v3.2c-2 .1-3.9.8-5.4 2Z" fill="url(#tl3Shine)" opacity=".85"></path>
                  </g>
                </svg>
    </>
  );
}

export const SETUP_ICONS: Array<{ label: string; href: string; Art: (props: { hovered: boolean }) => React.ReactElement }> = [
  { label: "Buat Data Perusahaan Baru", href: "/klien/baru", Art: Icon0 },
  { label: "Edit Perusahan & Buat Entitas", href: "/klien", Art: Icon1 },
  { label: "Buat & Edit Unit Bisnis", href: "/unit-bisnis", Art: Icon2 },
  { label: "Buat & Edit Akun Perusahaan", href: "/bagan-akun", Art: Icon3 },
  { label: "Buat & Edit Pengguna", href: "/pengguna", Art: Icon4 },
  { label: "Setelan Sistem", href: "/setelan", Art: Icon5 },
];
