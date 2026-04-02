import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Plus, MapPin } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Group {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  creator_id: string;
  created_at: string;
  member_count?: number;
}

export default function Community() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [myGroups, setMyGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchGroups();
  }, [user]);

  const fetchGroups = async () => {
    setLoading(true);
    const { data } = await supabase.from('community_groups').select('*').order('created_at', { ascending: false });
    if (data) {
      // Get member counts
      const groupsWithCounts = await Promise.all(
        data.map(async (g) => {
          const { count } = await supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', g.id);
          return { ...g, member_count: count ?? 0 };
        })
      );
      setGroups(groupsWithCounts);
    }
    if (user) {
      const { data: memberships } = await supabase.from('group_members').select('group_id').eq('user_id', user.id);
      if (memberships) setMyGroups(new Set(memberships.map(m => m.group_id)));
    }
    setLoading(false);
  };

  const createGroup = async () => {
    if (!user || !name.trim()) return;
    const { error } = await supabase.from('community_groups').insert({ creator_id: user.id, name: name.trim(), description: description.trim() || null, location: location.trim() || null });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    // Auto-join as member
    const { data: newGroup } = await supabase.from('community_groups').select('id').eq('creator_id', user.id).eq('name', name.trim()).single();
    if (newGroup) await supabase.from('group_members').insert({ group_id: newGroup.id, user_id: user.id });
    setShowCreate(false);
    setName(''); setDescription(''); setLocation('');
    toast({ title: 'Group created!' });
    fetchGroups();
  };

  const joinGroup = async (groupId: string) => {
    if (!user) return;
    const { error } = await supabase.from('group_members').insert({ group_id: groupId, user_id: user.id });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Joined group!' });
    fetchGroups();
  };

  const leaveGroup = async (groupId: string) => {
    if (!user) return;
    await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', user.id);
    toast({ title: 'Left group' });
    fetchGroups();
  };

  return (
    <div className="pb-20">
      <div className="px-4 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Community</h1>
          <p className="text-xs text-muted-foreground">Connect & collaborate with nearby homemakers</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Create</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Community Group</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Group Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Homemade Food Makers" /></div>
              <div><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this group about?" /></div>
              <div><Label>Location</Label><Input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Mumbai" /></div>
              <Button onClick={createGroup} className="w-full">Create Group</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="px-4 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : groups.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No community groups yet. Create the first one!</p>
          </div>
        ) : (
          groups.map(group => (
            <Card key={group.id} className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{group.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {group.description && <p className="text-sm text-muted-foreground mb-2">{group.description}</p>}
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {group.member_count} members</span>
                  {group.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {group.location}</span>}
                </div>
                {user && (
                  myGroups.has(group.id) ? (
                    <Button variant="outline" size="sm" onClick={() => leaveGroup(group.id)}>Leave Group</Button>
                  ) : (
                    <Button size="sm" onClick={() => joinGroup(group.id)}>Join Group</Button>
                  )
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
