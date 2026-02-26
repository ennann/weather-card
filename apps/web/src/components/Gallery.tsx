import { useState, useEffect, useRef, useCallback } from 'react';

interface Card {
  run_id: string;
  city: string;
  resolved_city_name: string | null;
  weather_date: string;
  weather_condition: string | null;
  weather_icon: string | null;
  temp_min: number | null;
  temp_max: number | null;
  current_temp: number | null;
  image_r2_key: string | null;
  created_at: string;
}

export default function Gallery() {
  const [cards, setCards] = useState<Card[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [lightbox, setLightbox] = useState<Card | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const pageRef = useRef(1);
  const loadingRef = useRef(false);

  const fetchCards = useCallback(async (p: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await fetch(`/api/cards?page=${p}&limit=20`);
      const data = (await res.json()) as { cards: Card[]; total: number };
      setCards((prev) => (p === 1 ? data.cards : [...prev, ...data.cards]));
      setTotal(data.total);
      pageRef.current = p;
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    fetchCards(1);
  }, [fetchCards]);

  useEffect(() => {
    if (!sentinel.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingRef.current) {
          const currentPage = pageRef.current;
          const loaded = cards.length;
          if (loaded > 0 && loaded < total) {
            fetchCards(currentPage + 1);
          }
        }
      },
      { rootMargin: '600px' }
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [cards.length, total, fetchCards]);

  // Close lightbox on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const imageUrl = (key: string) => `/api/images/${key}`;

  const hasMore = cards.length > 0 && cards.length < total;

  // Empty state
  if (!initialLoad && !loading && cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div
          className="mb-5 rounded-2xl p-5"
          style={{ background: 'linear-gradient(135deg, #FEF3E2 0%, #FDE8CD 100%)' }}
        >
          <svg className="h-10 w-10 text-[#E67E22]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
          </svg>
        </div>
        <p className="font-heading text-lg font-semibold text-ink">还没有卡片</p>
        <p className="mt-2 text-sm text-ink-muted">
          卡片将在每日生成任务完成后出现
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Card count */}
      {!initialLoad && total > 0 && (
        <div className="mb-3 sm:mb-5 fade-in">
          <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-surface-dim text-[11px] sm:text-[12px] font-medium text-ink-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
            {total} 张卡片
          </span>
        </div>
      )}

      {/* CSS Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
        {cards.map((card, i) => (
          <div
            key={card.run_id}
            className="card-rise cursor-pointer group"
            style={{ animationDelay: `${(i % 12) * 60}ms` }}
            onClick={() => card.image_r2_key && setLightbox(card)}
          >
            <div className="relative overflow-hidden rounded-xl bg-surface-raised shadow-sm ring-1 ring-border/40 transition-all duration-300 ease-out group-hover:shadow-lg group-hover:shadow-ink/5 group-hover:-translate-y-0.5 group-hover:ring-border">
              {card.image_r2_key && (
                <img
                  src={imageUrl(card.image_r2_key)}
                  alt={`${card.city} weather card`}
                  className="block w-full transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                  loading="lazy"
                />
              )}
              {/* City + date overlay */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent px-2.5 sm:px-3 pb-2 sm:pb-2.5 pt-6 sm:pt-8 flex items-end justify-between">
                <p className="text-[12px] sm:text-[13px] font-medium text-white/90 leading-tight drop-shadow-sm">
                  {card.resolved_city_name || card.city}
                </p>
                <p className="text-[10px] sm:text-[11px] text-white/60 leading-tight drop-shadow-sm">
                  {card.weather_date}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Loading skeletons */}
      {(initialLoad || loading) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 mt-2 sm:mt-3">
          {Array.from({ length: initialLoad ? 8 : 4 }).map((_, i) => (
            <div key={i}>
              <div
                className="skeleton rounded-xl"
                style={{ height: `${320 + (i % 3) * 40}px` }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Sentinel for infinite scroll */}
      {hasMore && <div ref={sentinel} className="h-1" />}

      {/* End indicator */}
      {!hasMore && cards.length > 0 && !loading && (
        <div className="text-center py-8 fade-in">
          <p className="text-[12px] text-ink-faint">已加载全部 {total} 张卡片</p>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && lightbox.image_r2_key && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-lg cursor-zoom-out fade-in"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative flex flex-col items-center px-4 sm:px-0 fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imageUrl(lightbox.image_r2_key)}
              alt={`${lightbox.city} weather card`}
              className="max-h-[78vh] max-w-[88vw] sm:max-w-sm w-auto rounded-2xl object-contain shadow-2xl cursor-zoom-out"
              onClick={() => setLightbox(null)}
            />
            {/* Card info below image */}
            <div className="mt-3 flex items-center justify-center gap-2 sm:gap-3 text-white/70 text-[12px] sm:text-[13px] flex-wrap">
              <span className="font-medium text-white/90">
                {lightbox.resolved_city_name || lightbox.city}
              </span>
              {lightbox.weather_icon && (
                <span>{lightbox.weather_icon} {lightbox.weather_condition}</span>
              )}
              {lightbox.temp_min != null && lightbox.temp_max != null && (
                <span>{lightbox.temp_min}° / {lightbox.temp_max}°</span>
              )}
              <span>{lightbox.weather_date}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
