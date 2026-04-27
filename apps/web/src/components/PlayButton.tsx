type Props = {
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

const SIZES = {
  sm: { box: 'h-9 w-9', tri: 8 },
  md: { box: 'h-12 w-12', tri: 11 },
  lg: { box: 'h-20 w-20 md:h-24 md:w-24', tri: 22 },
} as const

export default function PlayButton({ size = 'md', label = 'Play' }: Props) {
  const s = SIZES[size]
  return (
    <button
      type="button"
      aria-label={label}
      className={`${s.box} rounded-full border border-rust text-rust grid place-items-center hover:bg-rust hover:text-paper transition-colors duration-300`}
    >
      <svg
        viewBox="0 0 24 24"
        width={s.tri}
        height={s.tri}
        fill="currentColor"
        aria-hidden
      >
        <path d="M5 3.5v17a.5.5 0 0 0 .77.42l13-8.5a.5.5 0 0 0 0-.84l-13-8.5A.5.5 0 0 0 5 3.5Z" />
      </svg>
    </button>
  )
}
