
-- Create user_type enum
DO $$ BEGIN
  CREATE TYPE public.user_type AS ENUM ('provider', 'customer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create order_status enum
DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  user_type public.user_type NOT NULL DEFAULT 'customer',
  location TEXT,
  skills TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Services table
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  location TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  provider_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  status public.order_status NOT NULL DEFAULT 'pending',
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reviews table
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL UNIQUE,
  reviewer_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  provider_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Certificates table
CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  name TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Community groups table
CREATE TABLE public.community_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Group members table
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.community_groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Collaboration posts table
CREATE TABLE public.collaboration_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES public.community_groups(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Favorites table
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  provider_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_id, provider_id)
);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_community_groups_updated_at BEFORE UPDATE ON public.community_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_collaboration_posts_updated_at BEFORE UPDATE ON public.collaboration_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_provider()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND user_type = 'provider'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_customer()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND user_type = 'customer'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_review_order(_order_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = _order_id
      AND customer_id = auth.uid()
      AND status = 'completed'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.reviews WHERE order_id = _order_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_group_member(_group_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- SERVICES policies
CREATE POLICY "Anyone can view active services" ON public.services FOR SELECT TO authenticated USING (true);
CREATE POLICY "Providers can create services" ON public.services FOR INSERT TO authenticated WITH CHECK (provider_id = auth.uid() AND public.is_provider());
CREATE POLICY "Providers can update own services" ON public.services FOR UPDATE TO authenticated USING (provider_id = auth.uid()) WITH CHECK (provider_id = auth.uid());
CREATE POLICY "Providers can delete own services" ON public.services FOR DELETE TO authenticated USING (provider_id = auth.uid());

-- PRODUCTS policies
CREATE POLICY "Anyone can view products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Providers can create products" ON public.products FOR INSERT TO authenticated WITH CHECK (provider_id = auth.uid() AND public.is_provider());
CREATE POLICY "Providers can update own products" ON public.products FOR UPDATE TO authenticated USING (provider_id = auth.uid()) WITH CHECK (provider_id = auth.uid());
CREATE POLICY "Providers can delete own products" ON public.products FOR DELETE TO authenticated USING (provider_id = auth.uid());

-- ORDERS policies
CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT TO authenticated USING (customer_id = auth.uid() OR provider_id = auth.uid());
CREATE POLICY "Customers can create orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Providers can update order status" ON public.orders FOR UPDATE TO authenticated USING (provider_id = auth.uid()) WITH CHECK (provider_id = auth.uid());

-- REVIEWS policies
CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "Customers can create reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (reviewer_id = auth.uid() AND public.can_review_order(order_id));
CREATE POLICY "Reviewers can update own reviews" ON public.reviews FOR UPDATE TO authenticated USING (reviewer_id = auth.uid());
CREATE POLICY "Reviewers can delete own reviews" ON public.reviews FOR DELETE TO authenticated USING (reviewer_id = auth.uid());

-- CERTIFICATES policies
CREATE POLICY "Providers can view own certificates" ON public.certificates FOR SELECT TO authenticated USING (provider_id = auth.uid());
CREATE POLICY "Providers can upload certificates" ON public.certificates FOR INSERT TO authenticated WITH CHECK (provider_id = auth.uid() AND public.is_provider());
CREATE POLICY "Providers can update own certificates" ON public.certificates FOR UPDATE TO authenticated USING (provider_id = auth.uid());
CREATE POLICY "Providers can delete own certificates" ON public.certificates FOR DELETE TO authenticated USING (provider_id = auth.uid());

-- COMMUNITY GROUPS policies
CREATE POLICY "Anyone can view groups" ON public.community_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create groups" ON public.community_groups FOR INSERT TO authenticated WITH CHECK (creator_id = auth.uid());
CREATE POLICY "Creators can update own groups" ON public.community_groups FOR UPDATE TO authenticated USING (creator_id = auth.uid());
CREATE POLICY "Creators can delete own groups" ON public.community_groups FOR DELETE TO authenticated USING (creator_id = auth.uid());

-- GROUP MEMBERS policies
CREATE POLICY "Members can view group members" ON public.group_members FOR SELECT TO authenticated USING (public.is_group_member(group_id) OR group_id IN (SELECT id FROM public.community_groups WHERE creator_id = auth.uid()));
CREATE POLICY "Users can join groups" ON public.group_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can leave or creators can remove" ON public.group_members FOR DELETE TO authenticated USING (user_id = auth.uid() OR group_id IN (SELECT id FROM public.community_groups WHERE creator_id = auth.uid()));

-- COLLABORATION POSTS policies
CREATE POLICY "Group members can view posts" ON public.collaboration_posts FOR SELECT TO authenticated USING (public.is_group_member(group_id));
CREATE POLICY "Group members can create posts" ON public.collaboration_posts FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid() AND public.is_group_member(group_id));
CREATE POLICY "Authors can update own posts" ON public.collaboration_posts FOR UPDATE TO authenticated USING (author_id = auth.uid());
CREATE POLICY "Authors can delete own posts" ON public.collaboration_posts FOR DELETE TO authenticated USING (author_id = auth.uid());

-- FAVORITES policies
CREATE POLICY "Customers can view favorites" ON public.favorites FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Customers can add favorites" ON public.favorites FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Customers can remove favorites" ON public.favorites FOR DELETE TO authenticated USING (customer_id = auth.uid());

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('certificates', 'certificates', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

-- Storage policies
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Certificate files accessible by owner" ON storage.objects FOR SELECT USING (bucket_id = 'certificates' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Providers can upload certificates" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'certificates' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Providers can delete own certificates" ON storage.objects FOR DELETE USING (bucket_id = 'certificates' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Product images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Providers can upload product images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Providers can update product images" ON storage.objects FOR UPDATE USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Providers can delete product images" ON storage.objects FOR DELETE USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Indexes
CREATE INDEX idx_services_provider ON public.services(provider_id);
CREATE INDEX idx_services_category ON public.services(category);
CREATE INDEX idx_products_provider ON public.products(provider_id);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_orders_customer ON public.orders(customer_id);
CREATE INDEX idx_orders_provider ON public.orders(provider_id);
CREATE INDEX idx_reviews_provider ON public.reviews(provider_id);
CREATE INDEX idx_group_members_group ON public.group_members(group_id);
CREATE INDEX idx_group_members_user ON public.group_members(user_id);
CREATE INDEX idx_favorites_customer ON public.favorites(customer_id);
