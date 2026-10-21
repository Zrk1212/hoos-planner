import { MARK } from "./logo-paths";

/** The wire Rotunda, drawn in the current text color; same drawing as the browser-tab icon (app/icon.svg). */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="32" cy="15.6" rx="5" ry="2.6" fill="#ffb867" stroke="none" opacity="0.55" />
      <path d={MARK.heavy} strokeWidth="2.4" />
      <path d={MARK.light} strokeWidth="1.3" strokeOpacity="0.6" />
      <path d={MARK.cols} strokeWidth="2" />
      <circle cx="32" cy="38" r="1.3" strokeWidth="1.1" />
      <ellipse cx="32" cy="15.6" rx="2.6" ry="0.9" strokeWidth="1.2" />
    </svg>
  );
}
