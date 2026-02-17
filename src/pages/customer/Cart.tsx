import { useNavigate } from "react-router-dom";
import { ArrowLeft, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";

const Cart = () => {
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, clearCart, totalPrice, totalItems } = useCart();

  if (items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-lg text-muted-foreground">Your cart is empty</p>
        <Button onClick={() => navigate("/")}>Continue Shopping</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-sm font-semibold text-foreground">Cart ({totalItems} items)</h1>
      </header>

      <div className="container max-w-2xl py-4">
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
              <img
                src={item.image || "/placeholder.svg"}
                alt={item.name}
                className="h-20 w-20 shrink-0 rounded-lg object-cover bg-muted cursor-pointer"
                onClick={() => navigate(`/product/${item.id}`)}
              />
              <div className="flex flex-1 flex-col gap-1">
                <span className="line-clamp-2 text-sm font-medium text-foreground">{item.name}</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-bold text-foreground">₹{item.price}</span>
                  {item.mrp > item.price && (
                    <span className="text-xs text-muted-foreground line-through">₹{item.mrp}</span>
                  )}
                </div>
                <div className="mt-auto flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-border"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-border"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button onClick={() => removeItem(item.id)} className="ml-auto text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom checkout bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background p-3">
        <div className="container flex max-w-2xl items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{totalItems} items</p>
            <p className="text-lg font-bold text-foreground">₹{totalPrice.toFixed(2)}</p>
          </div>
          <Button className="px-8">Place Order</Button>
        </div>
      </div>
    </div>
  );
};

export default Cart;
