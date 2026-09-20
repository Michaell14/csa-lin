// One outline icon set, drawn on a 24px grid with currentColor, so every
// state (hover, selected, disabled) comes from CSS colour rather than a
// separate asset. The stroke defaults to 2px, which matches the medium-weight
// text and buttons the icons sit beside; pass strokeWidth={1.5} next to regular
// body text.

import type { SVGProps } from 'react'

type IconProps = Omit<SVGProps<SVGSVGElement>, 'stroke'> & { size?: number }

function Icon({ size = 16, strokeWidth = 2, children, ...rest }: IconProps) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {children}
    </svg>
  )
}

export const ChevronLeftIcon = (p: IconProps) => <Icon {...p}><path d="M15 6l-6 6 6 6" /></Icon>
export const ChevronRightIcon = (p: IconProps) => <Icon {...p}><path d="M9 6l6 6-6 6" /></Icon>
export const SortIcon = (p: IconProps) => <Icon {...p}><path d="M8 4v16m-3-3 3 3 3-3M16 20V4m-3 3 3-3 3 3" /></Icon>
export const PlusIcon = (p: IconProps) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>
export const PencilIcon = (p: IconProps) => <Icon {...p}><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></Icon>
export const CloseIcon = (p: IconProps) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>
export const CheckIcon = (p: IconProps) => <Icon {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Icon>
export const CircleIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="8" /></Icon>
export const AlertIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="8" /><path d="M12 8.5v4M12 15.5h.01" /></Icon>
export const BellIcon = (p: IconProps) => <Icon {...p}><path d="M6 9a6 6 0 0 1 12 0v4l2 3H4l2-3z" /><path d="M10 19a2 2 0 0 0 4 0" /></Icon>
export const TreeIcon = (p: IconProps) => <Icon {...p}><path d="M12 2v6M12 8l-6 5M12 8l6 5" /><circle cx="6" cy="17" r="3" /><circle cx="18" cy="17" r="3" /></Icon>

export const PhotoIcon = (p: IconProps) => <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" /><path d="m3 16 5-5 4 4 3-3 6 6" /></Icon>
export const RotateLeftIcon = (p: IconProps) => <Icon {...p}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></Icon>
export const RotateRightIcon = (p: IconProps) => <Icon {...p}><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></Icon>
