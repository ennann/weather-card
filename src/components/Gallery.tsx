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
      { rootMargin: '200px' }
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [loading, cards.length, total, page, fetchCards]);

  const imageUrl = (key: string) => `/api/images/${encodeURIComponent(key)}`;

  if (!loading && cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-neutral-500">
        <div className="text-6xl mb-4">🌤</div>
        <p className="font-display text-2xl italic text-neutral-400">No cards yet</p>
        <p className="mt-2 text-sm">Cards will appear here after the daily generation runs.</p>
      </div>
    );
  }

  return (
    <>
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
        {cards.map((card, i) => (
          <div
            key={card.run_id}
            className="card-animate mb-4 break-inside-avoid cursor-pointer group"
            style={{ animationDelay: `${(i % 8) * 60}ms` }}
            onClick={() => card.image_r2_key && setLightbox(imageUrl(card.image_r2_key))}
          >
            <div className="relative overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-neutral-800/50 transition-all duration-300 group-hover:ring-accent/30 group-hover:shadow-lg group-hover:shadow-accent/5">
              {card.image_r2_key && (
                <img
                  src={imageUrl(card.image_r2_key)}
                  alt={`${card.city} weather card`}
                  className="w-full transition-transform duration-500 group-hover:scale-[1.02]"
                  loading="lazy"
                />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="font-display text-lg leading-tight text-white">
                      {card.resolved_city_name || card.city}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-300">
                      {card.weather_date}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl">{card.weather_icon}</span>
                    <p className="text-xs text-neutral-300">
                      {card.temp_min}° / {card.temp_max}°
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-700 border-t-accent" />
        </div>
      )}

      <div ref={sentinel} className="h-1" />

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Full size card"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
