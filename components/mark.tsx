/** The ClathraRefine mark: a forecast line crossing ahead of a reading, inside a rounded tile. Same art as app/icon.svg. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="#0B1222" />
      <path d="M12 44 C 22 44, 26 40, 32 34" stroke="#22D3EE" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M32 34 C 38 28, 44 22, 52 16" stroke="#60A5FA" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray="6 6" />
      <circle cx="32" cy="34" r="5" fill="#F8FAFC" />
    </svg>
  );
}
