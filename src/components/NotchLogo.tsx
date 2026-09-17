type NotchLogoProps = {
  compact?: boolean;
  className?: string;
};

export default function NotchLogo({ compact = false, className = "" }: NotchLogoProps) {
  return (
    <span className={`notch-logo ${compact ? "notch-logo-compact" : ""} ${className}`.trim()} aria-label="Notch">
      <svg className="notch-logo-mark" viewBox="0 0 48 48" role="img" aria-hidden="true">
        <rect width="48" height="48" rx="13" fill="currentColor" />
        <path d="M14 34V14h6.2l8.6 11.6V14H35v20h-6.1l-8.7-11.7V34H14Z" fill="#FFF4E6" />
        <path d="M28.8 34 35 27.4V34h-6.2Z" fill="currentColor" />
      </svg>
      {!compact && <span className="notch-logo-word">notch</span>}
    </span>
  );
}
