import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Smartphone, Apple, Share2, Download, Loader2 } from "lucide-react";

interface DownloadAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DownloadAppDialog = ({ open, onOpenChange }: DownloadAppDialogProps) => {
  const [androidUrl, setAndroidUrl] = useState<string | null>(null);
  const [iosUrl, setIosUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["android_app_url", "ios_app_url"])
      .then(({ data }) => {
        data?.forEach((row) => {
          if (row.key === "android_app_url") setAndroidUrl(row.value);
          if (row.key === "ios_app_url") setIosUrl(row.value);
        });
        setLoading(false);
      });
  }, [open]);

  const handleShare = async (url: string, platform: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Download our ${platform} App`,
          text: `Install our ${platform} app`,
          url,
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
  };

  const handleInstall = (url: string) => {
    window.open(url, "_blank");
  };

  const hasAny = androidUrl || iosUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Download App
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasAny ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            No app downloads available yet.
          </div>
        ) : (
          <div className="space-y-4">
            {androidUrl && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Smartphone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Android App</p>
                    <p className="text-xs text-muted-foreground">APK file for Android devices</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => handleShare(androidUrl, "Android")}
                  >
                    <Share2 className="h-4 w-4" /> Share
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => handleInstall(androidUrl)}
                  >
                    <Download className="h-4 w-4" /> Install
                  </Button>
                </div>
              </div>
            )}

            {iosUrl && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Apple className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">iOS App</p>
                    <p className="text-xs text-muted-foreground">IPA file for iPhone & iPad</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => handleShare(iosUrl, "iOS")}
                  >
                    <Share2 className="h-4 w-4" /> Share
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => handleInstall(iosUrl)}
                  >
                    <Download className="h-4 w-4" /> Install
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DownloadAppDialog;
