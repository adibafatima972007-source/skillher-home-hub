import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { UtensilsCrossed, Scissors, Sparkles, BookOpen, ShoppingBag, Paintbrush, ChefHat, Home as HomeIcon } from 'lucide-react';
import logo from '@/assets/skillher-logo.png';

const directOrders = [
  { icon: ChefHat, label: 'Homemade Food', category: 'food' },
  { icon: Paintbrush, label: 'Handmade Crafts', category: 'crafts' },
  { icon: Scissors, label: 'Custom Clothing', category: 'clothing' },
  { icon: Sparkles, label: 'Beauty Products', category: 'beauty-products' },
];

const skillServices = [
  { icon: UtensilsCrossed, label: 'Cooking', category: 'cooking' },
  { icon: Scissors, label: 'Tailoring', category: 'tailoring' },
  { icon: Sparkles, label: 'Beauty Services', category: 'beauty' },
  { icon: BookOpen, label: 'Tutoring', category: 'tutoring' },
  { icon: HomeIcon, label: 'Home Assistance', category: 'home-assistance' },
];

export default function Index() {
  const { profile } = useAuth();

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/10 via-peach/30 to-accent/20 px-4 pt-6 pb-8">
        <div className="flex items-center justify-between mb-6">
          <img src={logo} alt="SkillHer" className="h-10" width={512} height={512} />
          <Link to="/dashboard" className="text-sm font-semibold text-primary">
            {profile?.display_name ? `Hi, ${profile.display_name.split(' ')[0]}!` : 'My Profile'}
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Discover Skills & Products</h1>
        <p className="text-muted-foreground text-sm">Support homemakers. Shop local talent.</p>
      </div>

      {/* Direct Orders */}
      <section className="px-4 mt-6">
        <div className="flex items-center gap-2 mb-3">
          <ShoppingBag className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Direct Orders</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Products you can order directly</p>
        <div className="grid grid-cols-2 gap-3">
          {directOrders.map(({ icon: Icon, label, category }) => (
            <Link
              key={category}
              to={`/marketplace?type=product&category=${category}`}
              className="bg-card rounded-xl p-4 border border-border hover:border-primary/50 hover:shadow-md transition-all flex flex-col items-center gap-2 text-center animate-fade-in"
            >
              <div className="w-12 h-12 rounded-full bg-peach flex items-center justify-center">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Skill Services */}
      <section className="px-4 mt-8">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-5 w-5 text-warm" />
          <h2 className="text-lg font-bold text-foreground">Skill Services</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Book services from skilled homemakers</p>
        <div className="grid grid-cols-2 gap-3">
          {skillServices.map(({ icon: Icon, label, category }) => (
            <Link
              key={category}
              to={`/marketplace?type=service&category=${category}`}
              className="bg-card rounded-xl p-4 border border-border hover:border-warm/50 hover:shadow-md transition-all flex flex-col items-center gap-2 text-center animate-fade-in"
            >
              <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
                <Icon className="h-6 w-6 text-warm" />
              </div>
              <span className="text-sm font-semibold text-foreground">{label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
