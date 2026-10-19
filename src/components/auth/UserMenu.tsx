import { useState, useRef, useEffect } from "react";
import { LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  className?: string;
  compact?: boolean;
}

export function UserMenu({ className, compact = false }: UserMenuProps) {
  const { user, logout, isLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const firstName = user.name.split(" ")[0];

  return (
    <div className={cn("relative inline-block text-left", className)} ref={menuRef}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-sm border border-border px-2.5 py-1.5 hover:bg-secondary transition-colors"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`User menu for ${user.name}`}
        data-testid="user-menu-button"
      >
        {user.profilePicture ? (
          <img
            src={user.profilePicture}
            alt={user.name}
            className="size-6 rounded-full object-cover border border-border"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span
            className="grid size-6 place-items-center rounded-full bg-primary/10 text-primary font-mono text-[11px] font-semibold"
            aria-hidden="true"
          >
            {initials || <UserIcon size={12} />}
          </span>
        )}
        {!compact && (
          <span className="text-xs font-medium text-foreground max-w-[120px] truncate">
            {firstName}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 w-56 origin-top-right rounded-sm border border-border bg-card p-2 shadow-lg animate-in fade-in-50 zoom-in-95 z-50"
        >
          <div className="border-b border-border px-3 py-2">
            <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
          </div>

          <div className="pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isLoading}
              onClick={async () => {
                setOpen(false);
                await logout();
              }}
              className="w-full justify-start gap-2 rounded-sm px-3 py-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              role="menuitem"
              data-testid="logout-button"
            >
              <LogOut size={13} aria-hidden="true" />
              <span>Sign out</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
