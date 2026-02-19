import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wrench, ArrowLeft, ChevronRight, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface Service {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  logo_url: string | null;
  website_url: string | null;
  category: string | null;
}

const PennyServices = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("services")
        .select("id, name, description, icon, image_url, logo_url, website_url, category")
        .eq("is_active", true)
        .order("sort_order");
      setServices((data as Service[]) ?? []);
      setLoading(false);
    };
    fetch();
  }, []);

  const grouped = services.reduce<Record<string, Service[]>>((acc, s) => {
    const cat = s.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-primary">
        <div className="container flex items-center gap-3 py-3">
          <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary-foreground" />
            <h1 className="text-lg font-bold text-primary-foreground">Penny Services</h1>
          </div>
        </div>
      </header>

      <main className="container py-6">
        {loading ? (
          <p className="text-center text-muted-foreground">Loading services...</p>
        ) : services.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Wrench className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">Services coming soon!</p>
            <p className="text-sm text-muted-foreground">We're adding partner services. Stay tuned.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([category, items]) => (
              <section key={category}>
                <h2 className="mb-4 font-heading text-xl font-bold text-foreground">{category}</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((s) => (
                    <div
                      key={s.id}
                      className="group relative flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:shadow-md hover:border-primary/30"
                    >
                      <button
                        onClick={() => navigate(`/services/${s.id}`)}
                        className="flex flex-1 items-center gap-4 min-w-0"
                      >
                        {s.logo_url || s.image_url ? (
                          <img
                            src={s.logo_url || s.image_url!}
                            alt={s.name}
                            className="h-16 w-16 shrink-0 rounded-lg object-contain bg-muted p-1"
                          />
                        ) : (
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Wrench className="h-7 w-7 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground">{s.name}</h3>
                          {s.description && (
                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{s.description}</p>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = `${window.location.origin}/services/${s.id}`;
                          const text = `Check out ${s.name} on Penny Services: ${url}`;
                          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                        }}
                        className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                        title="Share on WhatsApp"
                      >
                        <Share2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default PennyServices;
