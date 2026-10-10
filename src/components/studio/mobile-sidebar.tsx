import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";
import { useStrings } from "@/lib/i18n";

/** Drawer sidebar untuk mobile — dipakai semua halaman studio. */
export function MobileSidebar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useStrings();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" title={t["nav.menus"]} className="p-0 max-w-72">
        <Sidebar />
      </SheetContent>
    </Sheet>
  );
}
