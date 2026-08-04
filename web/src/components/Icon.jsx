// Minimal hand-rolled line icons (no icon library dependency for 5 glyphs).
const PATHS = {
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35',
  shield: 'M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3Zm-3 9 2 2 4-4',
  gauge: 'M12 21a9 9 0 1 0-9-9M12 21v-6M4 12h2M12 3v2M20 12h-2M6.3 6.3l1.4 1.4M17.7 6.3l-1.4 1.4',
  flag: 'M5 21V4m0 1h11l-2 4 2 4H5',
  dot: 'M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0',
}

export default function Icon({ name = 'dot', className = 'h-4 w-4' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={PATHS[name] || PATHS.dot} />
    </svg>
  )
}
