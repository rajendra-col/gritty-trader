import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { 
  BarChart3, 
  Search, 
  FileText, 
  TrendingUp, 
  Eye, 
  List, 
  LogOut, 
  Menu,
  Home
} from "lucide-react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Scanner", href: "/scanner", icon: Search },
  { name: "Scanner 1", href: "/scanner1", icon: Search },
  { name: "View Records", href: "/view-records", icon: FileText },
  { name: "Get Levels", href: "/get-levels", icon: TrendingUp },
  { name: "Watchlist", href: "/watchlist", icon: Eye },
  { name: "Stock List", href: "/stock-list", icon: List },
];

function SidebarContent() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex h-full w-full flex-col bg-sidebar">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4 lg:h-[60px] lg:px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold text-sidebar-foreground">
          <BarChart3 className="h-6 w-6 text-sidebar-primary" />
          <span className="text-lg">TradingView Pro</span>
        </Link>
      </div>
      <ScrollArea className="flex-1 px-3 py-2">
        <nav className="grid items-start gap-2 text-sm font-medium">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
      <div className="mt-auto p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={() => {
            localStorage.removeItem("auth");
            localStorage.removeItem("userEmail");
            navigate("/login", { replace: true });
          }}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="grid h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="sticky top-0 h-screen hidden border-r border-sidebar-border bg-sidebar md:block overflow-y-auto">
        <SidebarContent />
      </div>
      <div className="flex flex-col h-screen overflow-y-auto">
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6 md:hidden">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-0 w-[280px]">
              <SidebarContent />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">TradingView Pro</span>
          </div>
        </header>
        <main className="flex-1 flex flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
