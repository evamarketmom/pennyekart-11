import { Truck, Shield, Tag, Headphones } from "lucide-react";

const features = [
  { icon: Tag, title: "Best Prices", desc: "Unmatched deals on every category, every day." },
  { icon: Truck, title: "Fast Delivery", desc: "Quick doorstep delivery across India." },
  { icon: Shield, title: "Secure Payments", desc: "100% safe checkout with trusted gateways." },
  { icon: Headphones, title: "24/7 Support", desc: "Friendly customer care whenever you need it." },
];

const Features = () => (
  <section id="about" className="py-16 md:py-20">
    <div className="container">
      <h2 className="mb-12 text-center font-heading text-3xl font-bold md:text-4xl">
        Why Choose <span className="text-primary">Pennyekart</span>?
      </h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <div key={f.title} className="group rounded-xl border bg-card p-6 text-center transition-shadow hover:shadow-lg">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <f.icon className="h-6 w-6" />
            </div>
            <h3 className="mb-2 font-heading text-lg font-semibold">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Features;
