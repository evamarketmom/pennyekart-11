import logo from "@/assets/logo.png";
import { ShoppingCart, Menu, X, User, LogOut, Package, MapPin, Heart, Bell, ChevronDown, Wallet, UserPlus, Crown, Download } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import DownloadAppDialog from "@/components/DownloadAppDialog";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import InviteFriendDialog from "@/components/InviteFriendDialog";
import NotificationBell from "@/components/NotificationBell";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const links = ["Home", "Categories", "Deals", "About", "Contact"];

  useEffect(() => {
    if (user && profile?.user_type === 'customer') {
      supabase
        .from('customer_wallets')
        .select('balance')
        .eq('customer_user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setWalletBalance(data.balance);
        });
    }
  }, [user, profile]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);

  const menuItems = [
    { icon: User, label: "My Profile", action: () => navigate("/customer/profile") },
    { icon: Package, label: "Orders", action: () => navigate("/customer/profile") },
    { icon: Wallet, label: "Wallet", action: () => navigate("/customer/wallet") },
    { icon: Crown, label: "Penny Prime", action: () => navigate("/penny-prime") },
    { icon: MapPin, label: "Saved Addresses", action: () => navigate("/customer/profile") },
    { icon: Heart, label: "Wishlist", action: () => navigate("/customer/profile") },
    { icon: Bell, label: "Notifications", action: () => navigate("/customer/profile") },
    { icon: UserPlus, label: "Invite a Friend", action: () => setInviteOpen(true) },
    { icon: Download, label: "Download App", action: () => setDownloadOpen(true) },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <img src={logo} alt="Pennyekart" className="h-10" />

        <ul className="hidden gap-8 md:flex">
          {links.map((l) => (
            <li key={l}>
              <a href={`#${l.toLowerCase()}`} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                {l}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-4">
          {user && walletBalance !== null && (
            <button
              className="flex items-center gap-1 text-foreground hover:text-primary transition-colors"
              onClick={() => navigate("/customer/wallet")}
              aria-label="Wallet"
            >
              <Wallet className="h-4.5 w-4.5 text-emerald-600" />
              <span className="text-xs font-bold text-emerald-600">₹{walletBalance}</span>
            </button>
          )}
          {user && <NotificationBell />}
          <button className="relative text-foreground" aria-label="Cart" onClick={() => navigate("/cart")}>
            <ShoppingCart className="h-5 w-5" />
          </button>
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-label="Account menu"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium hidden sm:inline max-w-[100px] truncate">
                  {profile?.full_name || user.email?.split("@")[0] || "Account"}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 hidden sm:block transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-card rounded-lg border shadow-lg z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
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
                </div>
              )}
            </div>
          ) : (
            <button
              className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105 hidden sm:block"
              onClick={() => navigate("/customer/login")}
            >
              Sign In
            </button>
          )}
          <button className="md:hidden text-foreground" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t bg-card p-4 md:hidden">
          <ul className="flex flex-col gap-3">
            {links.map((l) => (
              <li key={l}>
                <a href={`#${l.toLowerCase()}`} className="text-sm font-medium text-muted-foreground" onClick={() => setOpen(false)}>
                  {l}
                </a>
              </li>
            ))}
            {!user && (
              <li>
                <button
                  className="mt-2 w-full rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
                  onClick={() => { navigate("/customer/login"); setOpen(false); }}
                >
                  Sign In
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
      <InviteFriendDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <DownloadAppDialog open={downloadOpen} onOpenChange={setDownloadOpen} />
    </nav>
  );
};

export default Navbar;
