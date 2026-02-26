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
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const fetchCards = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cards?page=${p}&limit=20`);
      const data = await res.json();
      setCards((prev) => (p === 1 ? data.cards : [...prev, ...data.cards]));
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards(1);
  }, [fetchCards]);

  useEffect(() => {
    if (!sentinel.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading && cards.length < total) {
          const next = page + 1;
          setPage(next);
          fetchCards(next);
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [loading, cards.length, total, page, fetchCards]);

  const imageUrl = (key: string) => `/api/images/${encodeURIComponent(key)}`;

  // Empty state
  if (!loading && cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <div className="mb-6 rounded-2xl bg-accent-soft p-5">
          <svg className="h-10 w-10 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
          </svg>
        </div>
        <p className="font-heading text-xl font-semibold text-ink">No cards yet</p>
        <p className="mt-2 text-sm text-ink-muted">
          Cards will appear here after the daily generation runs.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Masonry grid */}
      <div className="columns-2 gap-3 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5">
        {cards.map((card, i) => (
          <div
            key={card.run_id}
            className="card-rise mb-3 break-inside-avoid cursor-pointer group"
            style={{ animationDelay: `${(i % 10) * 80}ms` }}
            onClick={() => card.image_r2_key && setLightbox(imageUrl(card.image_r2_key))}
          >
            <div className="relative overflow-hidden rounded-2xl bg-surface-raised shadow-sm ring-1 ring-border/50 transition-all duration-300 ease-out group-hover:shadow-xl group-hover:shadow-accent/8 group-hover:-translate-y-1 group-hover:ring-accent/30">
              {card.image_r2_key && (
                <img
                  src={imageUrl(card.image_r2_key)}
                  alt={`${card.city} weather card`}
                  className="w-full transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  loading="lazy"
                />
              )}
              {/* Info overlay on hover */}
              <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-white/95 via-white/80 to-transparent p-3 pt-10 transition-transform duration-300 ease-out group-hover:translate-y-0">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="font-heading text-sm font-semibold text-ink leading-tight">
                      {card.resolved_city_name || card.city}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {card.weather_date}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-ink">
                      {card.weather_icon} {card.weather_condition}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {card.temp_min}° / {card.temp_max}°
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="columns-2 gap-3 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 mt-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="mb-3 break-inside-avoid">
              <div
                className="skeleton rounded-2xl"
                style={{ height: `${280 + (i % 3) * 80}px` }}
              />
            </div>
          ))}
        </div>
      )}

      <div ref={sentinel} className="h-1" />

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md cursor-zoom-out transition-opacity duration-200"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Full size card"
            className="max-h-[92vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl fade-in-up"
          />
        </div>
      )}
    </>
  );
}
