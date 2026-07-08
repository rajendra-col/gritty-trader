import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ApiClient from "@/lib/apiClient";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation() as unknown as { state?: { from?: Location } };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("auth") === "true") {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res: any = await ApiClient.post("/api/user/login", {
        email: email.trim(),
        password,
      });
      localStorage.setItem("auth", "true");
      localStorage.setItem("userEmail", email.trim());
      if (res?.token) localStorage.setItem("token", res.token);
      toast.success("Logged in successfully");
      const to = (location.state?.from as any)?.pathname || "/";
      navigate(to, { replace: true });
    } catch (err: any) {
      setError(err?.message || "Invalid email or password");
      toast.error(err?.message || "Invalid email or password");
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
            The Gritty Trader Login
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

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div
                className="text-destructive text-sm font-medium"
                role="alert"
              >
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate("/forgot-password")}
                className="flex-1"
              >
                Forgot Password
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
