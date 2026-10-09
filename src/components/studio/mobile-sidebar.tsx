import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";

/** Drawer sidebar untuk mobile — dipakai semua halaman studio. */
export function MobileSidebar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" title="Menus" className="p-0 max-w-72">
        <Sidebar />
      </SheetContent>
    </Sheet>
  );
}
