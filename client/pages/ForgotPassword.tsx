import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ApiClient from "@/lib/apiClient";
import { toast } from "sonner";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
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
      await ApiClient.post("/api/user/forgot-password", {
        email: email.trim(),
      });
      toast.success("OTP sent to your email");
      navigate("/verify-otp", { state: { email: email.trim() } });
    } catch (err: any) {
      toast.error(err?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "min-h-screen w-full bg-gradient-to-br from-background to-muted flex items-center justify-center p-4",
      )}
    >
      <Card className="w-full max-w-sm shadow-xl border-border">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Forgot Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send OTP"}
            </Button>

            {/* Buttons container: use flex so single button fills width, two buttons share equally */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate("/login")}
                className="flex-1"
              >
                Back to Login
              </Button>

              {/*
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/signup")}
          className="flex-1"
        >
          Create Account
        </Button>
        */}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
