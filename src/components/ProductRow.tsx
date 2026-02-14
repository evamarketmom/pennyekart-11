import { Star } from "lucide-react";

export interface Product {
  name: string;
  price: number;
  originalPrice?: number;
  rating: number;
  image: string;
}

interface ProductRowProps {
  title: string;
  products: Product[];
}

const ProductRow = ({ title, products }: ProductRowProps) => (
  <section className="bg-card py-4">
    <div className="container">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-heading text-lg font-bold text-foreground md:text-xl">{title}</h2>
        <button className="text-sm font-semibold text-primary hover:underline">View All</button>
      </div>

      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
        {products.map((p, i) => (
          <div
            key={i}
            className="group flex w-36 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-background transition-all hover:shadow-lg md:w-44"
          >
            <div className="relative aspect-square overflow-hidden bg-muted">
              <img
                src={p.image}
                alt={p.name}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
              {p.originalPrice && (
                <span className="absolute left-1.5 top-1.5 rounded-md bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
                  {Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)}% OFF
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1 p-2.5">
              <span className="line-clamp-2 text-xs font-medium text-foreground">{p.name}</span>
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-primary text-primary" />
                <span className="text-[11px] text-muted-foreground">{p.rating}</span>
              </div>
              <div className="mt-auto flex items-baseline gap-1.5">
                <span className="text-sm font-bold text-foreground">₹{p.price}</span>
                {p.originalPrice && (
                  <span className="text-[11px] text-muted-foreground line-through">₹{p.originalPrice}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default ProductRow;
