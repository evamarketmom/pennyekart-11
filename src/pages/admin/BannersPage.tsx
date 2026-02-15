import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Pencil, Trash2 } from "lucide-react";
import ImageUpload from "@/components/admin/ImageUpload";

interface Banner {
  id: string; title: string; image_url: string | null; link_url: string | null;
  is_active: boolean; sort_order: number;
}

const emptyBanner = { title: "", image_url: "", link_url: "", is_active: true, sort_order: 0 };

const BannersPage = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [form, setForm] = useState(emptyBanner);
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchBanners = async () => {
    const { data } = await supabase.from("banners").select("*").order("sort_order");
    setBanners((data as Banner[]) ?? []);
  };

  useEffect(() => { fetchBanners(); }, []);

  const handleSave = async () => {
    if (editId) {
      const { error } = await supabase.from("banners").update(form).eq("id", editId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("banners").insert({ ...form, created_by: user?.id });
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    }
    setOpen(false); setForm(emptyBanner); setEditId(null); fetchBanners();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("banners").delete().eq("id", id);
    fetchBanners();
  };

  const openEdit = (b: Banner) => {
    setForm({ title: b.title, image_url: b.image_url ?? "", link_url: b.link_url ?? "", is_active: b.is_active, sort_order: b.sort_order });
    setEditId(b.id); setOpen(true);
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Banners</h1>
        {hasPermission("create_banners") && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyBanner); setEditId(null); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Add Banner</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? "Edit Banner" : "New Banner"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <ImageUpload bucket="banners" value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} label="Banner Image" />
                <div><Label>Link URL</Label><Input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} /></div>
                <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: +e.target.value })} /></div>
                <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Active</Label></div>
                <Button className="w-full" onClick={handleSave}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {banners.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.title}</TableCell>
                <TableCell>{b.sort_order}</TableCell>
                <TableCell>{b.is_active ? "✓" : "✗"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {hasPermission("update_banners") && <Button variant="ghost" size="sm" onClick={() => openEdit(b)}><Pencil className="h-3.5 w-3.5" /></Button>}
                    {hasPermission("delete_banners") && <Button variant="ghost" size="sm" onClick={() => handleDelete(b.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {banners.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No banners yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
};

export default BannersPage;
