export function TaskcodeMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M24 4.5a19.5 19.5 0 1 0 0 39 19.5 19.5 0 0 0 0-39Z"
        stroke="var(--acc)"
        strokeWidth="2.5"
      />
      <path
        d="m19 16-5.5 8 5.5 8m10-16 5.5 8-5.5 8"
        stroke="var(--acc)"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m20.5 24.5 2.5 2.5 5-6"
        stroke="var(--acc)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
