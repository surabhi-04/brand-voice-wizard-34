import { useState } from "react";
import { ArrowRight, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getNotionAuthorizeUrl } from "@/lib/notion-service";

interface NotionConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId?: string;
}

export function NotionConnectModal({ open, onOpenChange }: NotionConnectModalProps) {
  const [connecting, setConnecting] = useState(false);

  async function handleConnect() {
    setConnecting(true);
    try {
      const { url } = await getNotionAuthorizeUrl(window.location.href);
      if (url) {
        window.location.href = url;
      } else {
        toast.error("Could not obtain Notion authorization URL.");
        setConnecting(false);
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to initiate Notion connection. Please try again.",
      );
      setConnecting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-card p-6 sm:p-7">
        <DialogHeader className="text-left space-y-3">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-sm bg-foreground text-background font-serif text-lg font-bold">
              N
            </div>
            <div>
              <DialogTitle className="font-display text-2xl tracking-tight text-foreground">
                Connect your Notion workspace
              </DialogTitle>
              <p className="text-xs uppercase tracking-wider font-mono text-accent font-semibold mt-0.5">
                Per-User Private Integration
              </p>
            </div>
          </div>
          <DialogDescription className="text-sm leading-6 text-muted-foreground pt-1">
            Connect your own Notion workspace so your generated brand campaigns are saved directly
            to your personal or team pages.
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 space-y-3 border-y border-border py-4 text-xs text-muted-foreground leading-5">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="size-4 text-primary shrink-0 mt-0.5" />
            <span>
              <strong className="text-foreground">Private & Isolated:</strong> Your campaigns are
              only saved to your authorized workspace. No other users have access.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <ExternalLink className="size-4 text-primary shrink-0 mt-0.5" />
            <span>
              <strong className="text-foreground">Choose destination pages:</strong> You select
              which pages or databases Notion allows Brand Voice AI to access.
            </span>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-sm"
            onClick={() => onOpenChange(false)}
            disabled={connecting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-sm font-medium gap-2"
            onClick={handleConnect}
            disabled={connecting}
            data-testid="confirm-connect-notion-button"
          >
            {connecting ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Connecting to Notion…
              </>
            ) : (
              <>
                Connect Notion Workspace
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
