"use client";

/** Full-screen dimmed overlay that centers a modal dialog. Click outside to close. */
export function Backdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {children}
    </div>
  );
}
