import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Plus, Package, Wrench, ShoppingCart, Star, LogOut, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [myServices, setMyServices] = useState<any[]>([]);
  const [myProducts, setMyProducts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [skills, setSkills] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Add service/product form
  const [showAddService, setShowAddService] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formLocation, setFormLocation] = useState('');

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    fetchData();
  }, [user]);

  useEffect(() => {
    if (profile) {
      setBio(profile.bio || '');
      setLocation(profile.location || '');
      setSkills(profile.skills?.join(', ') || '');
      setDisplayName(profile.display_name || '');
    }
  }, [profile]);

  const fetchData = async () => {
    if (!user) return;
    const { data: o } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    setOrders(o || []);
    if (profile?.user_type === 'provider') {
      const { data: s } = await supabase.from('services').select('*').eq('provider_id', user.id);
      setMyServices(s || []);
      const { data: p } = await supabase.from('products').select('*').eq('provider_id', user.id);
      setMyProducts(p || []);
      const { data: r } = await supabase.from('reviews').select('*').eq('provider_id', user.id);
      setReviews(r || []);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({
      display_name: displayName,
      bio,
      location,
      skills: skills.split(',').map(s => s.trim()).filter(Boolean),
    }).eq('user_id', user.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    await refreshProfile();
    setEditingProfile(false);
    toast({ title: 'Profile updated!' });
  };

  const addService = async () => {
    if (!user) return;
    const { error } = await supabase.from('services').insert({
      provider_id: user.id, name: formName, description: formDesc,
      category: formCategory, price: parseFloat(formPrice) || 0, location: formLocation,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setShowAddService(false);
    resetForm();
    toast({ title: 'Service added!' });
    fetchData();
  };

  const addProduct = async () => {
    if (!user) return;
    const { error } = await supabase.from('products').insert({
      provider_id: user.id, name: formName, description: formDesc,
      category: formCategory, price: parseFloat(formPrice) || 0,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setShowAddProduct(false);
    resetForm();
    toast({ title: 'Product added!' });
    fetchData();
  };

  const resetForm = () => { setFormName(''); setFormDesc(''); setFormCategory(''); setFormPrice(''); setFormLocation(''); };

  const handleSignOut = async () => { await signOut(); navigate('/auth'); };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const filePath = `${user.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
    if (uploadError) { toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' }); return; }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('user_id', user.id);
    await refreshProfile();
    toast({ title: 'Avatar updated!' });
  };

  if (!user || !profile) return null;

  const isProvider = profile.user_type === 'provider';

  return (
    <div className="pb-20 px-4 pt-6">
      {/* Profile Card */}
      <Card className="mb-6 border-border">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-peach flex items-center justify-center overflow-hidden">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">👤</span>
                )}
              </div>
              <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center cursor-pointer">
                <Upload className="h-3 w-3 text-primary-foreground" />
                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </label>
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-foreground">{profile.display_name || 'User'}</h2>
              <p className="text-xs text-muted-foreground capitalize">{profile.user_type}</p>
              {profile.location && <p className="text-xs text-muted-foreground">{profile.location}</p>}
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

          {editingProfile ? (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={displayName} onChange={e => setDisplayName(e.target.value)} /></div>
              <div><Label>Bio</Label><Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell people about yourself..." /></div>
              <div><Label>Location</Label><Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Your city" /></div>
              {isProvider && <div><Label>Skills (comma-separated)</Label><Input value={skills} onChange={e => setSkills(e.target.value)} placeholder="Cooking, Tailoring, Crafts" /></div>}
              <div className="flex gap-2">
                <Button onClick={saveProfile} size="sm">Save</Button>
                <Button variant="outline" size="sm" onClick={() => setEditingProfile(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div>
              {profile.bio && <p className="text-sm text-muted-foreground mb-2">{profile.bio}</p>}
              {isProvider && profile.skills?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {profile.skills.map(s => <span key={s} className="bg-peach text-peach-foreground text-xs px-2 py-0.5 rounded-full">{s}</span>)}
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => setEditingProfile(true)}>Edit Profile</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dashboard Tabs */}
      <Tabs defaultValue={isProvider ? 'services' : 'orders'}>
        <TabsList className="w-full">
          {isProvider && <TabsTrigger value="services" className="flex-1">Services</TabsTrigger>}
          {isProvider && <TabsTrigger value="products" className="flex-1">Products</TabsTrigger>}
          <TabsTrigger value="orders" className="flex-1">Orders</TabsTrigger>
          {isProvider && <TabsTrigger value="reviews" className="flex-1">Reviews</TabsTrigger>}
        </TabsList>

        {isProvider && (
          <TabsContent value="services" className="space-y-3">
            <Dialog open={showAddService} onOpenChange={setShowAddService}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Add Service</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Service</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Name</Label><Input value={formName} onChange={e => setFormName(e.target.value)} /></div>
                  <div><Label>Description</Label><Textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} /></div>
                  <div><Label>Category</Label><Input value={formCategory} onChange={e => setFormCategory(e.target.value)} placeholder="e.g. cooking, tailoring" /></div>
                  <div><Label>Price (₹)</Label><Input type="number" value={formPrice} onChange={e => setFormPrice(e.target.value)} /></div>
                  <div><Label>Location</Label><Input value={formLocation} onChange={e => setFormLocation(e.target.value)} /></div>
                  <Button onClick={addService} className="w-full">Add Service</Button>
                </div>
              </DialogContent>
            </Dialog>
            {myServices.map(s => (
              <Card key={s.id} className="border-border">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm text-foreground">{s.name}</span>
                    <span className="ml-auto text-primary font-bold text-sm">₹{s.price}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{s.category}</p>
                </CardContent>
              </Card>
            ))}
            {myServices.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No services yet</p>}
          </TabsContent>
        )}

        {isProvider && (
          <TabsContent value="products" className="space-y-3">
            <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Add Product</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Name</Label><Input value={formName} onChange={e => setFormName(e.target.value)} /></div>
                  <div><Label>Description</Label><Textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} /></div>
                  <div><Label>Category</Label><Input value={formCategory} onChange={e => setFormCategory(e.target.value)} placeholder="e.g. food, crafts" /></div>
                  <div><Label>Price (₹)</Label><Input type="number" value={formPrice} onChange={e => setFormPrice(e.target.value)} /></div>
                  <Button onClick={addProduct} className="w-full">Add Product</Button>
                </div>
              </DialogContent>
            </Dialog>
            {myProducts.map(p => (
              <Card key={p.id} className="border-border">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-warm" />
                    <span className="font-semibold text-sm text-foreground">{p.name}</span>
                    <span className="ml-auto text-primary font-bold text-sm">₹{p.price}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{p.category}</p>
                </CardContent>
              </Card>
            ))}
            {myProducts.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No products yet</p>}
          </TabsContent>
        )}

        <TabsContent value="orders" className="space-y-3">
          {orders.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No orders yet</p>
            </div>
          ) : (
            orders.map(o => (
              <Card key={o.id} className="border-border">
                <CardContent className="pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-foreground">Order #{o.id.slice(0, 8)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${o.status === 'completed' ? 'bg-green-100 text-green-700' : o.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-peach text-peach-foreground'}`}>
                      {o.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">₹{o.total}</p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {isProvider && (
          <TabsContent value="reviews" className="space-y-3">
            {reviews.length === 0 ? (
              <div className="text-center py-8">
                <Star className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No reviews yet</p>
              </div>
            ) : (
              reviews.map(r => (
                <Card key={r.id} className="border-border">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-1 mb-1">
                      {Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="h-3 w-3 fill-warm text-warm" />)}
                    </div>
                    {r.comment && <p className="text-sm text-foreground">{r.comment}</p>}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
