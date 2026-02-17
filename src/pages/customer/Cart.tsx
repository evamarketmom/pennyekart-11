import { useNavigate } from "react-router-dom";
import { ArrowLeft, Minus, Plus, Trash2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";
import { Separator } from "@/components/ui/separator";

const Cart = () => {
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, clearCart, totalPrice, totalItems } = useCart();

  const totalMrp = items.reduce((s, i) => s + i.mrp * i.quantity, 0);
  const totalDiscount = totalMrp - totalPrice;
  const platformFee = items.length > 0 ? 7 : 0;
  const finalAmount = totalPrice + platformFee;

  if (items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-lg text-muted-foreground">Your cart is empty</p>
        <Button onClick={() => navigate("/")}>Continue Shopping</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background px-4 py-3 shadow-sm">
        <button onClick={() => navigate(-1)} className="text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-foreground">Cart ({totalItems})</h1>
      </header>

      <div className="container max-w-5xl py-4 px-3 md:px-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          {/* Left: Cart Items */}
          <div className="flex-1 rounded-lg border border-border bg-card shadow-sm">
            {/* Items */}
            <div className="divide-y divide-border">
              {items.map(item => (
                <div key={item.id} className="p-4">
                  <div className="flex gap-4">
                    {/* Image */}
                    <img
                      src={item.image || "/placeholder.svg"}
                      alt={item.name}
                      className="h-24 w-24 shrink-0 cursor-pointer rounded-md object-cover bg-muted"
                      onClick={() => navigate(`/product/${item.id}`)}
                    />
                    {/* Info */}
                    <div className="flex flex-1 flex-col gap-1">
                      <span className="line-clamp-2 text-sm text-foreground">{item.name}</span>
                      <div className="mt-1 flex items-baseline gap-2">
                        {item.mrp > item.price && (
                          <span className="text-xs text-muted-foreground line-through">₹{item.mrp}</span>
                        )}
                        <span className="text-base font-bold text-foreground">₹{item.price}</span>
                        {item.mrp > item.price && (
                          <span className="text-xs font-medium text-secondary">
                            {Math.round(((item.mrp - item.price) / item.mrp) * 100)}% off
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quantity & actions */}
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex items-center rounded-md border border-border">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:bg-muted"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="flex h-8 w-10 items-center justify-center border-x border-border text-sm font-semibold">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:bg-muted"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-destructive"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Place Order - bottom of left card (mobile) */}
            <div className="border-t border-border p-4 lg:hidden">
              <Button className="w-full text-base font-semibold py-5">Place Order</Button>
            </div>
          </div>

          {/* Right: Price Details */}
          <div className="w-full lg:w-80 shrink-0 space-y-4">
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Price Details
              </h2>
              <Separator className="mb-3" />

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-foreground">MRP ({totalItems} items)</span>
                  <span className="text-foreground">₹{totalMrp.toFixed(2)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-foreground">Discount on MRP</span>
                    <span className="font-medium text-secondary">− ₹{totalDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-foreground">Platform Fee</span>
                  <span className="text-foreground">₹{platformFee}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground">Delivery Charges</span>
                  <span className="font-medium text-secondary">Free</span>
                </div>
              </div>

              <Separator className="my-3" />

              <div className="flex justify-between text-base font-bold">
                <span className="text-foreground">Total Amount</span>
                <span className="text-foreground">₹{finalAmount.toFixed(2)}</span>
              </div>

              {totalDiscount > 0 && (
                <p className="mt-2 text-xs font-medium text-secondary">
                  You will save ₹{totalDiscount.toFixed(2)} on this order
                </p>
              )}
            </div>

            {/* Place Order - desktop */}
            <div className="hidden lg:block">
              <Button className="w-full text-base font-semibold py-5">Place Order</Button>
            </div>

            {/* Trust badge */}
            <div className="flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground shadow-sm">
              <ShieldCheck className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span>Safe and Secure Payments. Easy returns. 100% Authentic products.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
