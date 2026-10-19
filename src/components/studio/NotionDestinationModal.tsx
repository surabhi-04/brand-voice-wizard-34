import { useEffect, useState } from "react";
import { Check, FileText, Folder, RefreshCw } from "lucide-react";
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
import {
  getNotionDestinations,
  setNotionDestination,
  type NotionDestinationItem,
} from "@/lib/notion-service";

interface NotionDestinationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDestinationId?: string | null;
  onDestinationUpdated?: (dest: { id: string; name: string }) => void;
}

export function NotionDestinationModal({
  open,
  onOpenChange,
  currentDestinationId,
  onDestinationUpdated,
}: NotionDestinationModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [destinations, setDestinations] = useState<NotionDestinationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(currentDestinationId || null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelectedId(currentDestinationId || null);
    getNotionDestinations()
      .then((res) => {
        setDestinations(res.destinations || []);
        if (res.currentDestinationId) {
          setSelectedId(res.currentDestinationId);
        } else if (res.destinations?.length > 0) {
          setSelectedId(res.destinations[0].id);
        }
      })
      .catch((err) => {
        toast.error(
          err instanceof Error ? err.message : "Failed to load Notion destination pages.",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, currentDestinationId]);

  async function handleSaveDestination() {
    if (!selectedId) return;
    const chosen = destinations.find((d) => d.id === selectedId);
    if (!chosen) return;

    setSaving(true);
    try {
      const res = await setNotionDestination(chosen.id, chosen.title);
      toast.success(`Default save destination updated to "${chosen.title}".`);
      onDestinationUpdated?.(res.destination);
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update Notion destination page.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-card p-6 sm:p-7">
        <DialogHeader className="text-left space-y-2">
          <DialogTitle className="font-display text-2xl tracking-tight text-foreground">
            Choose Notion save destination
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Select the parent page in your Notion workspace where campaign briefs and tweets will be
            created.
          </DialogDescription>
        </DialogHeader>

        <div className="my-3 max-h-[300px] overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <RefreshCw className="size-4 animate-spin text-primary" />
              Loading accessible workspace pages…
            </div>
          ) : destinations.length === 0 ? (
            <div className="border border-border/80 bg-secondary/40 p-4 rounded-sm text-center text-xs text-muted-foreground leading-5">
              <p className="font-semibold text-foreground">No shared pages found</p>
              <p className="mt-1">
                When connecting Notion, ensure you selected at least one page or database to share
                with the integration.
              </p>
            </div>
          ) : (
            destinations.map((dest) => {
              const isSelected = selectedId === dest.id;
              return (
                <button
                  key={dest.id}
                  type="button"
                  onClick={() => setSelectedId(dest.id)}
                  className={`w-full flex items-center justify-between gap-3 p-3 text-left rounded-sm border transition-colors ${
                    isSelected
                      ? "border-primary bg-secondary/70 text-foreground"
                      : "border-border bg-background hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="shrink-0 text-primary">
                      {dest.icon ? (
                        <span className="text-base">{dest.icon}</span>
                      ) : (
                        <FileText className="size-4" />
                      )}
                    </span>
                    <span className="text-sm font-medium truncate">{dest.title}</span>
                  </div>
                  {isSelected && <Check className="size-4 text-primary shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-sm"
            onClick={handleSaveDestination}
            disabled={saving || !selectedId || destinations.length === 0}
          >
            {saving ? (
              <>
                <RefreshCw className="size-4 animate-spin mr-1.5" />
                Saving…
              </>
            ) : (
              "Save Destination"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
