export function AircraftGlyph({ category }: { category: string | null }) {
  const helicopter = category === "A7";
  const light = category === "A1" || category === "A2";
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="-32 -34 64 68" aria-hidden="true" className={`plane-glyph ${category === "A5" ? "heavy-glyph" : ""}`}>
    {helicopter ? <>
      <ellipse cx="0" cy="-7" rx="5" ry="10" fill="currentColor" />
      <path d="M-1 1 L-2 24 L2 24 L1 1 M-8 22 H8 M-25 -7 H25 M0 -28 V14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    </> : light ? <>
      <path d="M0-28 C-3-28-3-20-3-9 L-26-5 L-26 0 L-3-1 L-2 21 L-10 25 L-10 28 L0 26 L10 28 L10 25 L2 21 L3-1 L26 0 L26-5 L3-9 C3-20 3-28 0-28Z" fill="currentColor" />
      <path d="M-7-20 H7" stroke="currentColor" strokeWidth="2" />
    </> : <>
      <path d="M0-30 C-2-30-3-26-3-18 L-4-7 L-27 9 L-27 13 L-4 5 L-3 20 L-11 27 L-11 30 L0 26 L11 30 L11 27 L3 20 L4 5 L27 13 L27 9 L4-7 L3-18 C3-26 2-30 0-30Z" fill="currentColor" />
      <path d="M-11 5 V12 M11 5 V12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </>}
  </svg>;
}