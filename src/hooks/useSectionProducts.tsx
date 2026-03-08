import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SectionProduct {
  id: string;
  name: string;
  price: number;
  mrp: number;
  discount_rate: number;
  image_url: string | null;
  category: string | null;
  section: string | null;
  coming_soon?: boolean;
  wallet_points?: number;
}

const sectionLabels: Record<string, string> = {
  featured: "Featured Products",
  most_ordered: "Most Ordered Items",
  new_arrivals: "New Arrivals",
  low_budget: "Low Budget Picks",
  sponsors: "Sponsors",
};

const fetchSectionProducts = async (): Promise<SectionProduct[]> => {
  // Fetch admin products with sections
  const { data: sectionData } = await supabase
    .from("products")
    .select("id, name, price, mrp, discount_rate, image_url, category, section, coming_soon, wallet_points")
    .eq("is_active", true)
    .not("section", "is", null)
    .neq("section", "")
    .limit(50);

  // Fetch featured seller products
  const { data: sellerFeatured } = await supabase
    .from("seller_products")
    .select("id, name, price, mrp, discount_rate, image_url, category, coming_soon, wallet_points")
    .eq("is_active", true)
    .eq("is_approved", true)
    .eq("is_featured", true)
    .limit(20);

  const adminProducts = (sectionData ?? []) as SectionProduct[];
  const sellerProducts = (sellerFeatured ?? []).map((p) => ({
    ...p,
    section: "featured" as string,
  })) as SectionProduct[];

  const combined = [...adminProducts, ...sellerProducts];

  if (combined.length > 0) {
    return combined;
  }

  // Fallback: fetch all active products (no section filter)
  const { data: allData } = await supabase
    .from("products")
    .select("id, name, price, mrp, discount_rate, image_url, category, section, coming_soon, wallet_points")
    .eq("is_active", true)
    .limit(50);
  return (allData as SectionProduct[]) ?? [];
};

export const useSectionProducts = () => {
  const { data: products = [], isLoading: loading } = useQuery({
    queryKey: ["section-products"],
    queryFn: fetchSectionProducts,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Group by section
  const grouped = products.reduce<Record<string, { label: string; items: SectionProduct[] }>>((acc, p) => {
    const sec = p.section!;
    if (!acc[sec]) acc[sec] = { label: sectionLabels[sec] || sec, items: [] };
    acc[sec].items.push(p);
    return acc;
  }, {});

  return { grouped, products, loading, sectionLabels };
};
