import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";

export function BarcodeScannerButton({
  onDetect,
}: {
  onDetect: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<Html5Qrcode | null>(null);
  const containerId = "qr-reader-container";

  useEffect(() => {
    if (!open) return;
    const start = async () => {
      try {
        const scanner = new Html5Qrcode(containerId);
        ref.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 160 } },
          (decoded) => {
            onDetect(decoded);
            void stop();
            setOpen(false);
          },
          () => {},
        );
      } catch (e) {
        toast.error("تعذر تشغيل الكاميرا");
        console.error(e);
        setOpen(false);
      }
    };
    void start();
    return () => {
      void stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const stop = async () => {
    try {
      if (ref.current) {
        await ref.current.stop();
        await ref.current.clear();
        ref.current = null;
      }
    } catch {
      // ignore
    }
  };

  return (
    <>
      <Button type="button" variant="outline" size="icon" onClick={() => setOpen(true)}>
        <Camera className="h-4 w-4" />
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) void stop();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>مسح الباركود</DialogTitle>
          </DialogHeader>
          <div id={containerId} className="w-full rounded-lg overflow-hidden bg-black" />
          <Button
            variant="outline"
            onClick={() => {
              void stop();
              setOpen(false);
            }}
          >
            <X className="h-4 w-4 ml-2" />
            إغلاق
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
