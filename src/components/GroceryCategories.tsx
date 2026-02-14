import { Apple, Carrot, Milk, Wheat, Fish, Egg, Cookie, Coffee, Citrus, Beef } from "lucide-react";

const groceries = [
  { icon: Apple, name: "Fruits" },
  { icon: Carrot, name: "Vegetables" },
  { icon: Milk, name: "Dairy" },
  { icon: Wheat, name: "Grains" },
  { icon: Fish, name: "Seafood" },
  { icon: Egg, name: "Eggs" },
  { icon: Cookie, name: "Snacks" },
  { icon: Coffee, name: "Beverages" },
  { icon: Citrus, name: "Organic" },
  { icon: Beef, name: "Meat" },
];

const GroceryCategories = () => (
  <section className="bg-card py-4">
    <div className="container">
      <h2 className="mb-3 font-heading text-lg font-bold text-foreground md:text-xl">
        Grocery & Essentials
      </h2>

      {/* Desktop: single row */}
      <div className="hidden md:flex items-center gap-3 overflow-x-auto scrollbar-hide">
        {groceries.map((g) => (
          <button
            key={g.name}
            className="group flex shrink-0 flex-col items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-3 transition-all hover:border-primary hover:shadow-md"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <g.icon className="h-6 w-6" />
            </div>
            <span className="text-xs font-semibold text-foreground">{g.name}</span>
          </button>
        ))}
      </div>

      {/* Mobile: two rows */}
      <div className="md:hidden space-y-2">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide">
          {groceries.slice(0, 5).map((g) => (
            <button
              key={g.name}
              className="group flex shrink-0 flex-col items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2.5"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <g.icon className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-medium text-foreground">{g.name}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide">
          {groceries.slice(5).map((g) => (
            <button
              key={g.name}
              className="group flex shrink-0 flex-col items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2.5"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <g.icon className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-medium text-foreground">{g.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default GroceryCategories;
