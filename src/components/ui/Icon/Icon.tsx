import { iconPaths, IconName } from './icons';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  className?: string;
  'aria-hidden'?: boolean;
}

export const Icon = ({
  name,
  size = 24,
  color = 'currentColor',
  className = '',
  'aria-hidden': ariaHidden = true,
}: IconProps) => {
  const pathData = iconPaths[name];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      <path d={pathData} />
    </svg>
  );
};
