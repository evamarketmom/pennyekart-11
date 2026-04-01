import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import banner1 from "@/assets/banner-1.jpg";
import banner2 from "@/assets/banner-2.jpg";
import banner3 from "@/assets/banner-3.jpg";

const fallbackBanners = [
  { src: banner1, alt: "Mega Sale - Electronics", link: "" },
  { src: banner2, alt: "Fashion Fest", link: "" },
  { src: banner3, alt: "Home Deals", link: "" },
];

const fetchBanners = async () => {
  const { data } = await supabase
    .from("banners")
    .select("title, image_url, link_url, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  if (data && data.length > 0) {
    return data.map((b) => ({
      src: b.image_url || "",
      alt: b.title,
      link: b.link_url || "",
    }));
  }
  return [];
};

const BannerCarousel = () => {
  const [current, setCurrent] = useState(0);
  const { data: banners = [] } = useQuery({
    queryKey: ["banners"],
    queryFn: fetchBanners,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const next = useCallback(
    () => setCurrent((c) => (c + 1) % banners.length),
    [banners.length]
  );
  const prev = useCallback(
    () => setCurrent((c) => (c - 1 + banners.length) % banners.length),
    [banners.length]
  );

  useEffect(() => {
    const id = setInterval(next, 4000);
    return () => clearInterval(id);
  }, [next]);

  const BannerImage = ({ src, alt, link, className }: { src: string; alt: string; link: string; className: string }) => {
    const img = <img src={src} alt={alt} className={className} loading="lazy" />;
    return link ? <a href={link} target="_blank" rel="noopener noreferrer">{img}</a> : img;
  };

  return (
    <section className="bg-muted/30 py-4">
      <div className="container">
        <div className="relative overflow-hidden rounded-xl">
          <div className="hidden md:flex gap-4 justify-center">
            {banners.map((b, i) => (
              <div key={i} className="w-1/3 shrink-0 overflow-hidden rounded-xl shadow-md transition-transform hover:scale-[1.02]">
                <BannerImage src={b.src} alt={b.alt} link={b.link} className="h-[400px] w-full object-cover" />
              </div>
            ))}
          </div>
          <div className="md:hidden relative">
            <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${current * 100}%)` }}>
              {banners.map((b, i) => (
                <div key={i} className="w-full shrink-0 px-1">
                  <BannerImage src={b.src} alt={b.alt} link={b.link} className="aspect-[3/4] w-full rounded-xl object-cover shadow-md" />
                </div>
              ))}
            </div>
            <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-card/80 p-1.5 shadow backdrop-blur-sm" aria-label="Previous">
              <ChevronLeft className="h-5 w-5 text-foreground" />
            </button>
            <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-card/80 p-1.5 shadow backdrop-blur-sm" aria-label="Next">
              <ChevronRight className="h-5 w-5 text-foreground" />
            </button>
            <div className="mt-3 flex justify-center gap-2">
              {banners.map((_, i) => (
                <button key={i} onClick={() => setCurrent(i)} className={`h-2 rounded-full transition-all ${i === current ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30"}`} aria-label={`Slide ${i + 1}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BannerCarousel;
