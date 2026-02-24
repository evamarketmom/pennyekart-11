import { Search, User, Wallet, ShoppingCart, LogOut, Package, MapPin, Heart, Bell, ChevronDown, Tag, Download } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DownloadAppDialog from "@/components/DownloadAppDialog";

const SearchBar = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

  const displayName = profile?.full_name || profile?.email || user?.email;
  const isLoggedIn = !!user;

  const updatePosition = useCallback(() => {
    const isMobile = window.innerWidth < 640;
    const activeBtn = isMobile ? mobileButtonRef.current : buttonRef.current;
    if (activeBtn) {
      const rect = activeBtn.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8,
        right: isMobile ? 8 : Math.max(8, window.innerWidth - rect.right),
      });
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        (!buttonRef.current || !buttonRef.current.contains(target)) &&
        (!mobileButtonRef.current || !mobileButtonRef.current.contains(target))
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (dropdownOpen) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [dropdownOpen, updatePosition]);

  const menuItems = [
    { icon: User, label: "My Profile", action: () => navigate("/customer/profile?tab=profile") },
    { icon: Package, label: "Orders", action: () => navigate("/customer/profile?tab=orders") },
    { icon: Wallet, label: "Wallet", action: () => navigate("/customer/wallet") },
    { icon: Tag, label: "Penny Prime", action: () => navigate("/penny-prime") },
    { icon: MapPin, label: "Saved Addresses", action: () => navigate("/customer/profile?tab=addresses") },
    { icon: Heart, label: "Wishlist", action: () => navigate("/customer/profile?tab=wishlist") },
    { icon: Bell, label: "Notifications", action: () => navigate("/customer/profile?tab=notifications") },
    { icon: Download, label: "Download App", action: () => setDownloadDialogOpen(true) },
  ];

  const dropdownPortal = dropdownOpen && isLoggedIn
    ? createPortal(
        <div
          ref={dropdownRef}
          className="fixed w-56 rounded-lg border bg-card shadow-lg py-2 animate-in fade-in slide-in-from-top-2 duration-200"
          style={{ top: dropdownPos.top, right: dropdownPos.right, zIndex: 9999 }}
        >
          <div className="px-4 py-2 border-b mb-1">
            <p className="text-sm font-semibold">Your Account</p>
          </div>
          {menuItems.map((item) => (
            <button
              key={item.label}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              onClick={() => { item.action(); setDropdownOpen(false); }}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
          <div className="border-t mt-1 pt-1">
            <button
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              onClick={async () => { await signOut(); navigate("/"); setDropdownOpen(false); }}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="border-b bg-card">
      <div className="container flex items-center gap-3 py-2.5">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search for Products, Brands and More"
            className="w-full rounded-lg border bg-muted/50 py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary focus:bg-card"
          />
        </div>

        {/* Actions - desktop */}
        <div className="hidden items-center gap-1 sm:flex">
          {isLoggedIn ? (
            <button
              ref={buttonRef}
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                <User className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="max-w-[120px] truncate">{displayName}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>
          ) : (
            <button onClick={() => navigate("/customer/login")} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
              <User className="h-4 w-4" />
              <span>Login</span>
            </button>
          )}
          <button onClick={() => navigate("/customer/wallet")} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
            <Wallet className="h-4 w-4" />
            <span>Wallet</span>
          </button>
          <button onClick={() => navigate("/cart")} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
            <ShoppingCart className="h-4 w-4" />
            <span>Cart</span>
          </button>
        </div>

        {/* Actions - mobile icons only */}
        <div className="flex items-center gap-2 sm:hidden">
          <button
            ref={mobileButtonRef}
            onClick={(e) => {
              e.stopPropagation();
              if (isLoggedIn) setDropdownOpen(!dropdownOpen);
              else navigate("/customer/login");
            }}
            className="rounded-lg p-2 text-foreground hover:bg-muted"
            aria-label={isLoggedIn ? displayName : "Login"}
          >
            <User className="h-5 w-5" />
          </button>
          <button onClick={() => navigate("/cart")} className="rounded-lg p-2 text-foreground hover:bg-muted" aria-label="Cart">
            <ShoppingCart className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Portal-rendered dropdown */}
      {dropdownPortal}
      <DownloadAppDialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen} />
    </div>
  );
};

export default SearchBar;
