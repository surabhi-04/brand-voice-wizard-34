import { useState } from "react";
import { Check, ChevronRight, ExternalLink, Link2, LogOut, RefreshCw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { disconnectNotion, type NotionStatus } from "@/lib/notion-service";

interface NotionWorkspaceStatusProps {
  user: { name: string; email: string } | null;
  notionStatus: NotionStatus;
  onConnectClick: () => void;
  onChangeDestinationClick: () => void;
  onStatusRefreshed?: () => void;
}

export function NotionWorkspaceStatus({
  user,
  notionStatus,
  onConnectClick,
  onChangeDestinationClick,
  onStatusRefreshed,
}: NotionWorkspaceStatusProps) {
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleDisconnect() {
    if (
      !window.confirm(
        `Disconnect your Notion workspace (${notionStatus.workspaceName || "connected"})? You can reconnect anytime.`,
      )
    ) {
      return;
    }

    setDisconnecting(true);
    try {
      await disconnectNotion();
      toast.success("Notion workspace disconnected.");
      onStatusRefreshed?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to disconnect Notion workspace.",
      );
    } finally {
      setDisconnecting(false);
    }
  }

  // Guest visitor
  if (!user) {
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-3 border border-border/80 bg-secondary/50 px-4 py-3 rounded-sm text-xs text-muted-foreground"
        data-testid="notion-status-guest"
      >
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-accent" />
          <span>
            <strong className="text-foreground">Guest Demo Mode:</strong> Generates campaign
            briefs freely. Sign in to connect your Notion workspace and save campaigns.
          </span>
        </div>
      </div>
    );
  }

  // Authenticated, Notion is connected
  if (notionStatus.connected) {
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-3 border border-primary/30 bg-secondary/70 px-4 py-3 rounded-sm text-xs"
        data-testid="notion-status-connected"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="grid size-6 place-items-center rounded-xs bg-foreground text-background font-serif text-[11px] font-bold shrink-0">
            N
          </div>
          <div className="min-w-0 truncate">
            <span className="font-semibold text-foreground">
              {notionStatus.workspaceName || "Notion Workspace"}
            </span>
            <span className="text-muted-foreground ml-1.5">
              · Destination:{" "}
              <strong className="text-foreground font-medium">
                {notionStatus.destination?.name || "Shared Page"}
              </strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={onChangeDestinationClick}
          >
            <Settings2 className="size-3 mr-1" />
            Change page
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive"
            onClick={handleDisconnect}
            disabled={disconnecting}
          >
            {disconnecting ? (
              <RefreshCw className="size-3 animate-spin mr-1" />
            ) : (
              <LogOut className="size-3 mr-1" />
            )}
            Disconnect
          </Button>
        </div>
      </div>
    );
  }

  // Authenticated, Notion is NOT connected
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card px-4 py-3 rounded-sm text-xs shadow-xs"
      data-testid="notion-status-not-connected"
    >
      <div className="flex items-center gap-2.5">
        <div className="grid size-6 place-items-center rounded-xs bg-muted text-muted-foreground font-serif text-[11px] font-bold shrink-0">
          N
        </div>
        <div>
          <span className="font-medium text-foreground">Notion workspace not connected</span>
          <span className="text-muted-foreground ml-1.5 hidden sm:inline">
            — Connect your workspace to save campaigns directly.
          </span>
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        className="h-7 px-3 text-xs rounded-sm gap-1.5"
        onClick={onConnectClick}
        data-testid="connect-notion-status-button"
      >
        <Link2 className="size-3" />
        Connect Notion
      </Button>
    </div>
  );
}
