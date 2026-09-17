/** Classes communes selects portail / coach — laisse de la place à la flèche native. */
export const selectFieldClass =
  'w-full appearance-none rounded-lg border border-black/15 bg-white bg-[length:12px_8px] bg-[right_0.85rem_center] bg-no-repeat py-2 pl-3 pr-10 text-sm text-[#1a1220]'

/** Chevron SVG (gris) en data-URI pour `background-image`. */
export const selectFieldStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
} as const
