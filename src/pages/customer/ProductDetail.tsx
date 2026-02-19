import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Star, ArrowLeft, ChevronDown, ChevronUp, Play, Clock, Building2, MapPin, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProductRow from "@/components/ProductRow";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface ProductData {
  id: string;
  name: string;
  price: number;
  mrp: number;
  discount_rate: number;
  description: string | null;
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  video_url: string | null;
  category: string | null;
  stock: number;
  coming_soon?: boolean;
}

const getYoutubeEmbedUrl = (url: string, autoplay = false) => {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  if (!match) return null;
  const params = autoplay ? "?autoplay=1&mute=1&loop=1&playlist=" + match[1] : "";
  return `https://www.youtube.com/embed/${match[1]}${params}`;
};

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductData | null>(null);
  const [similarProducts, setSimilarProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSlide, setActiveSlide] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const autoSlideRef = useRef<NodeJS.Timeout | null>(null);
  const { addItem } = useCart();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [availableStock, setAvailableStock] = useState<number | null>(null);

  const [productSource, setProductSource] = useState<"product" | "seller_product">("product");
  const [productSellerId, setProductSellerId] = useState<string | undefined>();
  const [sellerInfo, setSellerInfo] = useState<{
    company_name: string | null;
    business_address: string | null;
    business_city: string | null;
    business_state: string | null;
    business_pincode: string | null;
    business_phone: string | null;
    business_email: string | null;
  } | null>(null);

  const handleAddToCart = () => {
    if (!product) return;
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      mrp: product.mrp,
      image: product.image_url || "",
      source: productSource,
      seller_id: productSellerId,
    });
    toast({ title: "Added to cart", description: `${product.name} added to your cart.` });
  };

  const handleBuyNow = () => {
    if (!product) return;
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      mrp: product.mrp,
      image: product.image_url || "",
      source: productSource,
      seller_id: productSellerId,
    });
    navigate("/cart");
  };

  // Build slides: images + video
  const imageUrls = product
    ? [product.image_url, product.image_url_2, product.image_url_3].filter(Boolean) as string[]
    : [];
  const embedUrl = product?.video_url ? getYoutubeEmbedUrl(product.video_url, true) : null;
  const slides: { type: "image" | "video"; src: string }[] = [
    ...imageUrls.map(src => ({ type: "image" as const, src })),
    ...(embedUrl ? [{ type: "video" as const, src: embedUrl }] : []),
  ];

  // Auto-slide logic
  const startAutoSlide = useCallback(() => {
    if (autoSlideRef.current) clearInterval(autoSlideRef.current);
    if (slides.length <= 1) return;
    autoSlideRef.current = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % slides.length);
    }, 3000);
  }, [slides.length]);

  useEffect(() => {
    startAutoSlide();
    return () => { if (autoSlideRef.current) clearInterval(autoSlideRef.current); };
  }, [startAutoSlide]);

  // Fetch godown stock for user's area
  useEffect(() => {
    const fetchGodownStock = async () => {
      if (!product || !profile?.local_body_id || !profile?.ward_number) {
        setAvailableStock(product?.stock ?? 0);
        return;
      }

      // Get micro godown IDs
      const { data: microWards } = await supabase
        .from("godown_wards")
        .select("godown_id, godowns!inner(godown_type)")
        .eq("local_body_id", profile.local_body_id)
        .eq("ward_number", profile.ward_number)
        .eq("godowns.godown_type", "micro");

      // Get area godown IDs
      const { data: areaLocalBodies } = await supabase
        .from("godown_local_bodies")
        .select("godown_id, godowns!inner(godown_type)")
        .eq("local_body_id", profile.local_body_id)
        .eq("godowns.godown_type", "area");

      const godownIds = new Set<string>();
      microWards?.forEach(r => godownIds.add(r.godown_id));
      areaLocalBodies?.forEach(r => godownIds.add(r.godown_id));

      if (godownIds.size === 0) {
        setAvailableStock(product.stock);
        return;
      }

      const { data: stockData } = await supabase
        .from("godown_stock")
        .select("quantity")
        .eq("product_id", product.id)
        .in("godown_id", Array.from(godownIds));

      const totalGodownStock = stockData?.reduce((sum, s) => sum + s.quantity, 0) ?? 0;
      setAvailableStock(totalGodownStock > 0 ? totalGodownStock : product.stock);
    };

    fetchGodownStock();
  }, [product, profile?.local_body_id, profile?.ward_number]);

  // Fetch seller info when it's a seller product
  useEffect(() => {
    const fetchSellerInfo = async () => {
      if (!productSellerId) {
        setSellerInfo(null);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("company_name, business_address, business_city, business_state, business_pincode, business_phone, business_email")
        .eq("user_id", productSellerId)
        .single();
      setSellerInfo(data);
    };
    fetchSellerInfo();
  }, [productSellerId]);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;

      // Try main products table first
      let productData: ProductData | null = null;
      const { data } = await supabase
        .from("products")
        .select("id, name, price, mrp, discount_rate, description, image_url, image_url_2, image_url_3, video_url, category, stock, coming_soon")
        .eq("id", id)
        .eq("is_active", true)
        .maybeSingle();

      if (data) {
        productData = data as ProductData;
        setProductSource("product");
        setProductSellerId(undefined);
      } else {
        // Fallback: check seller_products table
        const { data: sellerData } = await supabase
          .from("seller_products")
          .select("id, name, price, mrp, discount_rate, description, image_url, image_url_2, image_url_3, video_url, category, stock, seller_id, coming_soon")
          .eq("id", id)
          .eq("is_active", true)
          .eq("is_approved", true)
          .maybeSingle();
        if (sellerData) {
          productData = sellerData as ProductData;
          setProductSource("seller_product");
          setProductSellerId(sellerData.seller_id);
        }
      }

      if (productData) {
        setProduct(productData);
        if (productData.category) {
          const { data: similar } = await supabase
            .from("products")
            .select("id, name, price, mrp, discount_rate, description, image_url, image_url_2, image_url_3, video_url, category, stock")
            .eq("category", productData.category)
            .eq("is_active", true)
            .neq("id", id)
            .limit(10);
          setSimilarProducts((similar as ProductData[]) || []);
        }
      }
      setLoading(false);
    };
    fetchProduct();
    setActiveSlide(0);
    window.scrollTo(0, 0);
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Product not found</p>
        <Button variant="outline" onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  const effectiveStock = availableStock ?? product.stock;
  const isComingSoon = product.coming_soon === true;
  const isOrderBlocked = isComingSoon || effectiveStock <= 0;

  const discountPercent = product.mrp > product.price
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
    : 0;


  const similarRowProducts = similarProducts.map(p => ({
    id: p.id,
    name: p.name,
    price: p.price,
    originalPrice: p.mrp > p.price ? p.mrp : undefined,
    rating: 4.5,
    image: p.image_url || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop",
  }));

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="line-clamp-1 text-sm font-semibold text-foreground">{product.name}</h1>
      </header>

      <main>
        {/* Auto-sliding Image/Video Gallery */}
        <div className="flex flex-col md:flex-row">
          <div className="relative w-full md:w-1/2">
            {/* Main slide */}
            <div className="aspect-square w-full overflow-hidden bg-muted">
              {slides.length > 0 && slides[activeSlide]?.type === "video" ? (
                <iframe
                  src={slides[activeSlide].src}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Product video"
                />
              ) : (
                <img
                  src={slides[activeSlide]?.src || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop"}
                  alt={product.name}
                  className="h-full w-full object-contain transition-opacity duration-500"
                />
              )}
            </div>

            {/* Dot indicators */}
            {slides.length > 1 && (
              <div className="absolute bottom-16 left-1/2 flex -translate-x-1/2 gap-1.5">
                {slides.map((_, i) => (
                  <button
                    key={i}
                  onClick={() => { setActiveSlide(i); if (autoSlideRef.current) clearInterval(autoSlideRef.current); }}
                    className={`h-2 w-2 rounded-full transition-all ${
                      activeSlide === i ? "bg-primary w-4" : "bg-foreground/30"
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Thumbnails */}
            <div className="flex gap-2 overflow-x-auto p-3">
              {slides.map((slide, i) => (
                <button
                  key={i}
                  onClick={() => { setActiveSlide(i); if (autoSlideRef.current) clearInterval(autoSlideRef.current); }}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                    activeSlide === i ? "border-primary" : "border-border"
                  }`}
                >
                  {slide.type === "video" ? (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <Play className="h-5 w-5 text-primary" />
                    </div>
                  ) : (
                    <img src={slide.src} alt={`View ${i + 1}`} className="h-full w-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="flex-1 p-4 md:p-6">
            <h2 className="text-lg font-bold text-foreground md:text-xl">{product.name}</h2>

            <div className="mt-2 flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5">
                <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                <span className="text-xs font-semibold text-primary">4.5</span>
              </div>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">₹{product.price}</span>
              {discountPercent > 0 && (
                <>
                  <span className="text-sm text-muted-foreground line-through">₹{product.mrp}</span>
                  <span className="text-sm font-semibold text-destructive">{discountPercent}% OFF</span>
                </>
              )}
            </div>

            {isComingSoon && (
              <div className="mt-2 flex items-center gap-1.5 rounded-md bg-warning/10 px-3 py-1.5 w-fit border border-warning/30">
                <Clock className="h-4 w-4 text-warning" />
                <span className="text-sm font-semibold text-warning">Coming Soon — Not available for order yet</span>
              </div>
            )}
            {!isComingSoon && effectiveStock <= 0 && (
              <p className="mt-2 text-sm font-medium text-destructive">Out of stock</p>
            )}

            {/* All Details Accordion */}
            <div className="mt-6 border-t border-border pt-4">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex w-full items-center justify-between text-left"
              >
                <div>
                  <h3 className="font-bold text-foreground">All details</h3>
                  <p className="text-xs text-muted-foreground">Features, description and more</p>
            </div>

            {/* Company Details */}
            {sellerInfo && (
              <div className="mt-4 border-t border-border pt-4">
                <h3 className="flex items-center gap-2 font-bold text-foreground">
                  <Building2 className="h-4 w-4 text-primary" />
                  Sold by
                </h3>
                {sellerInfo.company_name && (
                  <p className="mt-2 text-sm font-semibold text-foreground">{sellerInfo.company_name}</p>
                )}
                {(sellerInfo.business_address || sellerInfo.business_city) && (
                  <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                      {[sellerInfo.business_address, sellerInfo.business_city, sellerInfo.business_state, sellerInfo.business_pincode]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </p>
                )}
                {sellerInfo.business_phone && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3 shrink-0" />
                    {sellerInfo.business_phone}
                  </p>
                )}
                {sellerInfo.business_email && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3 shrink-0" />
                    {sellerInfo.business_email}
                  </p>
                )}
              </div>
            )}
                {showDetails ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
              </button>
              {showDetails && (
                <div className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">
                  {product.description || "No additional details available."}
                </div>
              )}
            </div>

            {/* Sticky Add to Cart (desktop) */}
            <div className="mt-6 hidden gap-3 md:flex">
              <Button variant="outline" className="flex-1" disabled={isOrderBlocked} onClick={handleAddToCart}>
                Add to cart
              </Button>
              <Button className="flex-1" disabled={isOrderBlocked} onClick={handleBuyNow}>
                Buy at ₹{product.price}
              </Button>
            </div>
          </div>
        </div>

        {/* Similar Products */}
        {similarRowProducts.length > 0 && (
          <div className="mt-4">
            <ProductRow title="Similar Products" products={similarRowProducts} linkPrefix="/product/" />
          </div>
        )}
      </main>

      {/* Mobile sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex gap-2 border-t border-border bg-background p-3 md:hidden">
        <Button variant="outline" className="flex-1" disabled={isOrderBlocked} onClick={handleAddToCart}>
          Add to cart
        </Button>
        <Button className="flex-1" disabled={isOrderBlocked} onClick={handleBuyNow}>
          Buy at ₹{product.price}
        </Button>
      </div>
    </div>
  );
};

export default ProductDetail;
