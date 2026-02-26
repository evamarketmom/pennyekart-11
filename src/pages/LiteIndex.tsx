import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ShoppingCart, User, Home, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLiteMode } from "@/hooks/useLiteMode";
import { useSectionProducts } from "@/hooks/useSectionProducts";
import { useAreaProducts } from "@/hooks/useAreaProducts";
import logo from "@/assets/logo.png";

const LiteIndex = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { toggleLiteMode } = useLiteMode();
  const { grouped, loading: sectionLoading } = useSectionProducts();
  const { products: areaProducts, loading: areaLoading } = useAreaProducts();
  const [search, setSearch] = useState("");

  const isCustomer = user && profile?.user_type === "customer";
  const sourceProducts = isCustomer ? areaProducts : Object.values(grouped).flatMap(g => g.items);
  const loading = isCustomer ? areaLoading : sectionLoading;

  const filtered = search
    ? sourceProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : sourceProducts;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Simple header */}
      <header className="sticky top-0 z-50 border-b bg-primary text-primary-foreground">
        <div className="flex items-center justify-between px-3 py-2">
          <img src={logo} alt="Pennyekart" className="h-7" />
          <div className="flex items-center gap-1">
            <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
              Lite
            </span>
            <button onClick={toggleLiteMode} className="ml-2 rounded p-1.5 text-xs hover:bg-primary-foreground/20" title="Switch to full version">
              <Zap className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="border-b bg-card px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded border bg-muted/50 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Product list - simple, no images for speed */}
      <main className="px-3 py-2">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {search ? "No products found." : "No products available."}
          </p>
        ) : (
          <ul className="divide-y">
            {filtered.map((p, i) => (
              <li
                key={p.id || i}
                className="flex items-center justify-between gap-2 py-3 cursor-pointer active:bg-muted/50"
                onClick={() => p.id && navigate(`/product/${p.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.category || "General"}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-primary">₹{p.price}</p>
                  {p.mrp > p.price && (
                    <p className="text-[11px] text-muted-foreground line-through">₹{p.mrp}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Simple bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card md:hidden">
        <div className="flex items-center justify-around py-2">
          <button onClick={() => navigate("/")} className="flex flex-col items-center gap-0.5 text-[10px] text-primary">
            <Home className="h-5 w-5" />
            Home
          </button>
          <button onClick={() => navigate(user ? "/customer/profile" : "/customer/login")} className="flex flex-col items-center gap-0.5 text-[10px] text-muted-foreground">
            <User className="h-5 w-5" />
            Account
          </button>
          <button onClick={() => navigate("/cart")} className="flex flex-col items-center gap-0.5 text-[10px] text-muted-foreground">
            <ShoppingCart className="h-5 w-5" />
            Cart
          </button>
        </div>
      </nav>

      <div className="pb-16 md:pb-0" />
    </div>
  );
};

export default LiteIndex;
