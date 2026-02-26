import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";

interface LocalBody {
  id: string;
  name: string;
  body_type: string;
  ward_count: number;
  district_id: string;
}

interface District {
  id: string;
  name: string;
}

interface Props {
  userType: "delivery_staff" | "selling_partner";
  title: string;
  description: string;
}

const nativeSelectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const PartnerSignup = ({ userType, title, description }: Props) => {
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [dob, setDob] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [localBodyId, setLocalBodyId] = useState("");
  const [wardNumber, setWardNumber] = useState("");
  const [districts, setDistricts] = useState<District[]>([]);
  const [localBodies, setLocalBodies] = useState<LocalBody[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.from("locations_districts").select("id, name").eq("is_active", true).order("sort_order")
      .then(({ data, error }) => {
        if (error) console.error("District fetch error:", error);
        if (data) setDistricts(data);
      });
  }, []);

  useEffect(() => {
    if (!districtId) { setLocalBodies([]); return; }
    supabase.from("locations_local_bodies").select("id, name, body_type, ward_count, district_id")
      .eq("district_id", districtId).eq("is_active", true).order("sort_order")
      .then(({ data, error }) => {
        if (error) console.error("Local body fetch error:", error);
        if (data) setLocalBodies(data as LocalBody[]);
      });
  }, [districtId]);

  const selectedLocalBody = localBodies.find(lb => lb.id === localBodyId);
  const wardOptions = selectedLocalBody ? Array.from({ length: selectedLocalBody.ward_count }, (_, i) => i + 1) : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (!/^\d{10}$/.test(mobile)) {
      toast({ title: "Enter a valid 10-digit mobile number", variant: "destructive" });
      return;
    }
    setLoading(true);

    const email = `${mobile}@pennyekart.local`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          mobile_number: mobile,
          date_of_birth: dob,
          user_type: userType,
          local_body_id: localBodyId || null,
          ward_number: wardNumber ? parseInt(wardNumber) : null,
        },
      },
    });

    if (error) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
    } else {
      await supabase.auth.signOut();
      toast({ title: "Registration successful!", description: "Your account is pending admin approval." });
      navigate(userType === "delivery_staff" ? "/delivery-staff/login" : "/selling-partner/login");
    }
    setLoading(false);
  };

  const loginPath = userType === "delivery_staff" ? "/delivery-staff/login" : "/selling-partner/login";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={logo} alt="Pennyekart" className="mx-auto mb-4 h-12" />
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={100} />
            </div>
            <div>
              <Label htmlFor="mobile">Mobile Number</Label>
              <Input id="mobile" type="tel" placeholder="10-digit number" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} required />
            </div>
            <div>
              <Label htmlFor="dob">Date of Birth</Label>
              <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="district">District</Label>
              <select
                id="district"
                value={districtId}
                onChange={(e) => { setDistrictId(e.target.value); setLocalBodyId(""); setWardNumber(""); }}
                className={nativeSelectClass}
              >
                <option value="">Select district</option>
                {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="localBody">Panchayath / Municipality</Label>
              <select
                id="localBody"
                value={localBodyId}
                onChange={(e) => { setLocalBodyId(e.target.value); setWardNumber(""); }}
                disabled={!districtId}
                className={nativeSelectClass}
              >
                <option value="">Select panchayath</option>
                {localBodies.map(lb => <option key={lb.id} value={lb.id}>{lb.name} ({lb.body_type})</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="ward">Ward</Label>
              <select
                id="ward"
                value={wardNumber}
                onChange={(e) => setWardNumber(e.target.value)}
                disabled={!localBodyId}
                className={nativeSelectClass}
              >
                <option value="">Select ward</option>
                {wardOptions.map(w => <option key={w} value={String(w)}>Ward {w}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Repeat Password</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Registering..." : "Sign Up"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already registered? <Link to={loginPath} className="text-primary underline">Login here</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnerSignup;
