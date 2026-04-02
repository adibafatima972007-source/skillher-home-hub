import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Search, Star, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Listing {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  image_url: string | null;
  location?: string | null;
  type: 'product' | 'service';
  provider: { display_name: string | null; avatar_url: string | null } | null;
  avg_rating: number;
  review_count: number;
}

export default function Marketplace() {
  const [searchParams] = useSearchParams();
  const [listings, setListings] = useState<Listing[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const typeFilter = searchParams.get('type');
  const categoryFilter = searchParams.get('category');

  useEffect(() => {
    fetchListings();
  }, [typeFilter, categoryFilter]);

  const fetchListings = async () => {
    setLoading(true);
    const items: Listing[] = [];

    if (!typeFilter || typeFilter === 'product') {
      let q = supabase.from('products').select('*, provider:profiles!products_provider_id_fkey(display_name, avatar_url)').eq('is_active', true);
      if (categoryFilter) q = q.eq('category', categoryFilter);
      const { data } = await q;
      if (data) {
        for (const p of data) {
          const { data: reviews } = await supabase.from('reviews').select('rating').eq('provider_id', p.provider_id);
          const avg = reviews?.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
          items.push({ ...p, type: 'product', provider: p.provider as any, avg_rating: avg, review_count: reviews?.length ?? 0 });
        }
      }
    }

    if (!typeFilter || typeFilter === 'service') {
      let q = supabase.from('services').select('*, provider:profiles!services_provider_id_fkey(display_name, avatar_url)').eq('is_active', true);
      if (categoryFilter) q = q.eq('category', categoryFilter);
      const { data } = await q;
      if (data) {
        for (const s of data) {
          const { data: reviews } = await supabase.from('reviews').select('rating').eq('provider_id', s.provider_id);
          const avg = reviews?.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
          items.push({ ...s, type: 'service', provider: s.provider as any, avg_rating: avg, review_count: reviews?.length ?? 0 });
        }
      }
    }

    setListings(items);
    setLoading(false);
  };

  const filtered = listings.filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="pb-20">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-foreground mb-4">Marketplace</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search skills & products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="px-4 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No listings yet. Be the first to add one!</p>
          </div>
        ) : (
          filtered.map(item => (
            <div key={item.id} className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow">
              <div className="flex gap-3">
                <div className="w-16 h-16 rounded-lg bg-peach flex items-center justify-center text-2xl shrink-0">
                  {item.type === 'product' ? '📦' : '✨'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-foreground text-sm truncate">{item.name}</h3>
                    <span className="text-primary font-bold text-sm whitespace-nowrap">₹{item.price}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.provider?.display_name || 'Provider'}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    {item.review_count > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-warm">
                        <Star className="h-3 w-3 fill-current" /> {item.avg_rating.toFixed(1)} ({item.review_count})
                      </span>
                    )}
                    {item.location && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {item.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
