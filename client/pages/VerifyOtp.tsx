import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ApiClient from "@/lib/apiClient";
import { toast } from "sonner";

export default function VerifyOtp() {
  const navigate = useNavigate();
  const location = useLocation() as unknown as { state?: { email?: string } };
  const [email, setEmail] = useState(location.state?.email || "");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("auth") === "true") {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await ApiClient.post("/api/user/verify-otp", { email: email.trim(), otp: otp.trim() });
      toast.success("OTP verified. Reset your password.");
      navigate("/reset-password", { state: { email: email.trim() } });
    } catch (err: any) {
      toast.error(err?.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("min-h-screen w-full bg-gradient-to-br from-background to-muted flex items-center justify-center p-4")}> 
      <Card className="w-full max-w-sm shadow-xl border-border">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Verify OTP</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="example@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="otp">OTP</Label>
              <Input id="otp" type="text" placeholder="Enter OTP" value={otp} onChange={(e) => setOtp(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying..." : "Verify"}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="ghost" onClick={() => navigate("/forgot-password")}>Resend OTP</Button>
              <Button type="button" variant="ghost" onClick={() => navigate("/login")}>Back to Login</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
