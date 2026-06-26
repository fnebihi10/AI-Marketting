import { useTheme } from '../../context/ThemeContext';
import logoFull from '../../assets/logo-full.png';
import logoWhite from '../../assets/logo-white.png';

type BrandLogoProps = {
  className?: string;
  alt?: string;
  decorative?: boolean;
};

export default function BrandLogo({
  className = '',
  alt = 'AI Marketing Studio logo',
  decorative = false,
}: BrandLogoProps) {
  const { theme } = useTheme();
  const sizeClassName = className.trim() || 'h-11 w-auto';

  return (
    <img
      src={theme === 'dark' ? logoWhite : logoFull}
      alt={decorative ? '' : alt}
      aria-hidden={decorative ? true : undefined}
      className={`${sizeClassName} object-contain`}
    />
  );
}
