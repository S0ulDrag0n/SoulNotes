'use client';

interface ModeTabProps {
  label: string;
  icon: string;
  isActive: boolean;
  onClick: () => void;
}

export function ModeTab({
  label,
  icon,
  isActive,
  onClick,
}: ModeTabProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition
        ${isActive
          ? 'bg-[#1f1c16] text-[#f6e9cc] dark:bg-[#f6e9cc] dark:text-[#1f1c16]'
          : 'text-[#5c4d39] hover:bg-[#efe0c3] dark:text-[#d6c5ad] dark:hover:bg-[#2a2218]'
        }
      `}
      title={label}
    >
      <span>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}