/** Fullscreen kiosk bez public headeru / max-width shellu. */
export default function PublicKioskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[200] overflow-hidden bg-black text-white">
      {children}
    </div>
  );
}
