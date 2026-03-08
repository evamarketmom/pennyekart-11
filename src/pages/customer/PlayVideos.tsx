import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Eye } from "lucide-react";
import MobileBottomNav from "@/components/MobileBottomNav";

interface VideoProduct {
  id: string;
  name: string;
  price: number;
  mrp: number;
  image_url: string | null;
  video_url: string;
  category: string | null;
}

const getYoutubeThumbnail = (url: string): string | null => {
  try {
    const u = new URL(url);
    let videoId = u.searchParams.get("v");
    if (!videoId && u.hostname === "youtu.be") videoId = u.pathname.slice(1);
    if (!videoId && u.pathname.includes("/embed/")) videoId = u.pathname.split("/embed/")[1]?.split("?")[0];
    if (!videoId && u.pathname.includes("/shorts/")) videoId = u.pathname.split("/shorts/")[1]?.split("?")[0];
    return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
  } catch { return null; }
};

const getYoutubeEmbedUrl = (url: string): string | null => {
  try {
    const u = new URL(url);
    let videoId = u.searchParams.get("v");
    if (!videoId && u.hostname === "youtu.be") videoId = u.pathname.slice(1);
    if (!videoId && u.pathname.includes("/embed/")) videoId = u.pathname.split("/embed/")[1]?.split("?")[0];
    if (!videoId && u.pathname.includes("/shorts/")) videoId = u.pathname.split("/shorts/")[1]?.split("?")[0];
    return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : null;
  } catch { return null; }
};

const fetchVideoProducts = async (): Promise<VideoProduct[]> => {
  const [prodRes, sellerRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, price, mrp, image_url, video_url, category")
      .eq("is_active", true)
      .not("video_url", "is", null)
      .neq("video_url", "")
      .limit(100),
    supabase
      .from("seller_products")
      .select("id, name, price, mrp, image_url, video_url, category")
      .eq("is_active", true)
      .eq("is_approved", true)
      .not("video_url", "is", null)
      .neq("video_url", "")
      .limit(100),
  ]);

  const all: VideoProduct[] = [];
  if (prodRes.data) all.push(...(prodRes.data as VideoProduct[]));
  if (sellerRes.data) all.push(...(sellerRes.data as VideoProduct[]));
  return all;
};

const PlayVideos = () => {
  const navigate = useNavigate();
  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["play-videos"],
    queryFn: fetchVideoProducts,
    staleTime: 5 * 60 * 1000,
  });

  const [playingId, setPlayingId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-orange-500 to-amber-500 text-white">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
              <Play className="h-4 w-4 fill-white text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Product Videos</h1>
              <p className="text-[10px] opacity-80">{videos.length} videos available</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-video animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-100 to-amber-100">
              <Play className="h-10 w-10 text-orange-500" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">No Videos Yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">Product videos will appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {videos.map((v) => {
              const thumb = getYoutubeThumbnail(v.video_url);
              const embedUrl = getYoutubeEmbedUrl(v.video_url);
              const isPlaying = playingId === v.id;
              const discount = v.mrp > v.price ? Math.round(((v.mrp - v.price) / v.mrp) * 100) : 0;

              return (
                <div key={v.id} className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-lg">
                  {/* Video / Thumbnail */}
                  <div className="relative aspect-video bg-black">
                    {isPlaying && embedUrl ? (
                      <iframe
                        src={embedUrl}
                        className="h-full w-full"
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                      />
                    ) : (
                      <button
                        onClick={() => setPlayingId(v.id)}
                        className="relative h-full w-full"
                      >
                        <img
                          src={thumb || v.image_url || "/placeholder.svg"}
                          alt={v.name}
                          className="h-full w-full object-cover"
                        />
                        {/* Play overlay */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/40">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-500 shadow-lg shadow-orange-500/30 transition-transform group-hover:scale-110">
                            <Play className="ml-1 h-7 w-7 fill-white text-white" />
                          </div>
                        </div>
                        {/* Duration-style badge */}
                        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                          <Eye className="h-3 w-3" />
                          Watch
                        </div>
                      </button>
                    )}
                    {/* Discount badge */}
                    {discount > 0 && (
                      <div className="absolute left-2 top-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                        {discount}% OFF
                      </div>
                    )}
                  </div>

                  {/* Product info */}
                  <button
                    onClick={() => navigate(`/product/${v.id}`)}
                    className="w-full p-3 text-left transition-colors hover:bg-accent/50"
                  >
                    <p className="line-clamp-2 text-sm font-medium text-foreground">{v.name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-base font-bold text-primary">₹{v.price}</span>
                      {v.mrp > v.price && (
                        <span className="text-xs text-muted-foreground line-through">₹{v.mrp}</span>
                      )}
                    </div>
                    {v.category && (
                      <span className="mt-1 inline-block rounded-full bg-accent px-2 py-0.5 text-[10px] text-muted-foreground">
                        {v.category}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
};

export default PlayVideos;

import { useState } from "react";
