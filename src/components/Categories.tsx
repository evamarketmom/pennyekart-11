import { Smartphone, Shirt, Home, Dumbbell, Sparkles, BookOpen } from "lucide-react";

const categories = [
  { icon: Smartphone, name: "Electronics", count: "2,400+" },
  { icon: Shirt, name: "Fashion", count: "5,100+" },
  { icon: Home, name: "Home & Living", count: "1,800+" },
  { icon: Dumbbell, name: "Sports", count: "900+" },
  { icon: Sparkles, name: "Beauty", count: "1,200+" },
  { icon: BookOpen, name: "Books", count: "3,600+" },
];

const Categories = () => (
  <section id="categories" className="bg-muted/50 py-16 md:py-20">
    <div className="container">
      <h2 className="mb-12 text-center font-heading text-3xl font-bold md:text-4xl">
        Browse <span className="text-primary">Categories</span>
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {categories.map((c) => (
          <button key={c.name} className="group flex flex-col items-center gap-3 rounded-xl border bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-lg">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/10 text-secondary transition-colors group-hover:bg-secondary group-hover:text-secondary-foreground">
              <c.icon className="h-6 w-6" />
            </div>
            <span className="text-sm font-semibold">{c.name}</span>
            <span className="text-xs text-muted-foreground">{c.count} items</span>
          </button>
        ))}
      </div>
    </div>
  </section>
);

export default Categories;
