import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { ShieldCheck, Sparkles } from "lucide-react";

interface SignInRequiredModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

export function SignInRequiredModal({
  open,
  onOpenChange,
  title = "Sign in to save to Notion",
  description = "You generated a campaign in Guest Demo Mode! To save it to your Notion workspace and view personal campaign history, sign in with your Google account.",
}: SignInRequiredModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-card p-6 sm:p-7">
        <DialogHeader className="text-left space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-full bg-secondary text-primary">
              <Sparkles className="size-4" />
            </span>
            <div>
              <DialogTitle className="font-display text-2xl tracking-tight text-foreground">
                {title}
              </DialogTitle>
              <p className="text-xs uppercase tracking-wider font-mono text-accent font-semibold mt-0.5">
                Authentication Required
              </p>
            </div>
          </div>
          <DialogDescription className="text-sm leading-6 text-muted-foreground pt-1">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 border-y border-border py-4 text-xs text-muted-foreground leading-5 space-y-2">
          <div className="flex items-start gap-2">
            <ShieldCheck className="size-4 text-primary shrink-0 mt-0.5" />
            <span>
              Your personal campaign drafts, tweet edits, and connected Notion tokens are securely
              isolated to your account.
            </span>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-3 pt-2 items-center justify-between">
          <Button
            type="button"
            variant="outline"
            className="rounded-sm w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <div className="w-full sm:w-auto flex justify-center">
            <GoogleSignInButton
              size="default"
              text="Sign in with Google"
              onSuccess={() => onOpenChange(false)}
            />
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
