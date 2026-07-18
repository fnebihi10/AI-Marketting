import likoshaniLogo from '../../assets/likoshani-company.png';

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
  const sizeClassName = className.trim() || 'h-11 w-auto';

  return (
    <img
      src={likoshaniLogo}
      alt={decorative ? '' : alt === 'AI Marketing Studio logo' ? 'Likoshani Company logo' : alt}
      aria-hidden={decorative ? true : undefined}
      className={`${sizeClassName} object-contain`}
    />
  );
}
