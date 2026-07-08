import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ApiClient from "@/lib/apiClient";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import MultiWatchlistDialog from "@/components/MultiWatchlistDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Heart,
  HeartOff,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertTriangle,
} from "lucide-react";

// Updated interface to match API response
interface Stock {
  _id: string;
  Symbol: string;
  StockName: string;
  Range: number;
  isWatchlist?: boolean;
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
}

// Updated API Response interface
interface APIResponse {
  success?: boolean;
  total: number;
  page: number;
  limit: number;
  data: Stock[];
}

type SortField = "Symbol" | "StockName" | "Range" | "createdAt" | "updatedAt";
type SortOrder = "asc" | "desc";

export default function StockList() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("StockName");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<Stock | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  // Form states
  const [formData, setFormData] = useState({
    Symbol: "",
    StockName: "",
    Range: 0,
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [submitting, setSubmitting] = useState(false);

  // Watchlist updating states
  const [updatingWatchlistIds, setUpdatingWatchlistIds] = useState<Set<string>>(
    new Set(),
  );
  const [wlDialogOpen, setWlDialogOpen] = useState(false);
  const [wlSymbol, setWlSymbol] = useState("");
  const [wlPendingStockId, setWlPendingStockId] = useState<string | null>(null);

  // Bulk add-to-watchlist dialog state
  const [bulkWishlistDialogOpen, setBulkWishlistDialogOpen] = useState(false);

  useEffect(() => {
    fetchStocks();
  }, [searchQuery, sortField, sortOrder, currentPage, limit]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortField, sortOrder, limit]);

  // 🔥 UPDATED: fetchStocks function with better error handling
  const fetchStocks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: searchQuery,
        sortField: sortField,
        sortOrder: sortOrder,
        page: currentPage.toString(),
        limit: limit.toString(),
      });

      console.log("🔄 Fetching stocks:", `/api/stock/list?${params}`);

      const response: APIResponse = await ApiClient.get(
        `/api/stock/list?${params}`,
      );

      console.log("✅ Received response:", response);

      if (response && response.data && Array.isArray(response.data)) {
        const priority = ["NIFTY", "BANKNIFTY", "CNXFINANCE", "MIDCPNIFTY1!"];
        const prioritized = [...response.data].sort((a, b) => {
          const ai = priority.indexOf(a.Symbol);
          const bi = priority.indexOf(b.Symbol);
          if (ai !== -1 || bi !== -1) {
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
          }
          return a.StockName.localeCompare(b.StockName);
        });
        setStocks(prioritized);
        setTotal(response.total || 0);
        console.log(`📋 Loaded ${prioritized.length} stocks`);
      } else {
        console.warn("⚠️ Invalid response format:", response);
        setStocks([]);
        setTotal(0);
        toast.error("Invalid response format from server");
      }
    } catch (error: any) {
      console.error("❌ Error fetching stocks:", error);
      setStocks([]);
      setTotal(0);

      if (error?.response?.status === 404) {
        toast.error(
          "API endpoint not found. Please check server configuration.",
        );
      } else if (
        error?.message?.includes("NetworkError") ||
        error?.message?.includes("fetch")
      ) {
        toast.error(
          "Network error. Please check your connection and try again.",
        );
      } else {
        toast.error(
          "Error loading stocks: " + (error?.message || "Unknown error"),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // 🔥 FIXED: Dynamic Watchlist Toggle Function
  const handleToggleWatchlist = async (stockId: string) => {
    if (updatingWatchlistIds.has(stockId)) {
      return;
    }

    setUpdatingWatchlistIds((prev) => new Set(prev).add(stockId));

    try {
      console.log(`🔄 Toggling watchlist for stock ${stockId}`);

      const response = await ApiClient.fetch(
        `/api/stock/watchlist/${stockId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      console.log("✅ Watchlist toggle response:", response);

      if (response && response._id) {
        const serverWatchlistStatus = response.isWatchlist;

        setStocks((prevStocks) =>
          prevStocks.map((stock) => {
            if (stock._id === stockId) {
              return { ...stock, isWatchlist: serverWatchlistStatus };
            }
            return stock;
          }),
        );

        // Show success toast
        if (serverWatchlistStatus) {
          toast.success(`✅ ${response.Symbol} added to watchlist!`);
        } else {
          toast.success(`❌ ${response.Symbol} removed from watchlist!`);
        }

        console.log(
          `✅ Watchlist updated to: ${serverWatchlistStatus} for stock ${stockId}`,
        );
      } else {
        throw new Error(response?.message || "Failed to update watchlist");
      }
    } catch (error: any) {
      console.error("❌ Error updating watchlist:", error);

      if (error?.response?.status === 404) {
        toast.error("Stock not found or watchlist API unavailable");
      } else {
        const errorMessage = error?.message || "Failed to update watchlist";
        toast.error(`Error: ${errorMessage}`);
      }
    } finally {
      setUpdatingWatchlistIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(stockId);
        return newSet;
      });
    }
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  };

  const handleStockSelection = (stockId: string) => {
    setSelectedStocks((prev) =>
      prev.includes(stockId)
        ? prev.filter((id) => id !== stockId)
        : [...prev, stockId],
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedStocks(checked ? stocks.map((stock) => stock._id) : []);
  };

  const validateForm = () => {
    const errors: { [key: string]: string } = {};

    if (!formData.Symbol.trim()) {
      errors.Symbol = "Symbol is required";
    } else if (formData.Symbol.length > 20) {
      errors.Symbol = "Symbol must be 20 characters or less";
    }

    if (!formData.StockName.trim()) {
      errors.StockName = "Stock name is required";
    } else if (formData.StockName.length > 100) {
      errors.StockName = "Stock name must be 100 characters or less";
    }

    if (formData.Range <= 0) {
      errors.Range = "Range must be greater than 0";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 🔥 FIXED: Create Stock Function
  const handleCreateStock = async () => {
    if (!validateForm()) return;
    setSubmitting(true);

    try {
      console.log("🔄 Creating stock with data:", formData);

      const createdStock = await ApiClient.post("/api/stock", {
        Symbol: formData.Symbol,
        StockName: formData.StockName,
        Range: formData.Range,
        isWatchlist: false,
      });

      console.log("✅ Stock created successfully:", createdStock);

      if (createdStock && createdStock._id) {
        setIsCreateDialogOpen(false);
        setFormData({ Symbol: "", StockName: "", Range: 0 });
        setFormErrors({});
        await fetchStocks();
        toast.success(`Stock "${createdStock.Symbol}" created successfully!`);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error: any) {
      console.error("❌ Error creating stock:", error);

      if (error?.response?.status === 404) {
        setFormErrors({
          general: "Create stock API not available. Please check server.",
        });
        toast.error("Create stock API not found");
      } else if (
        error?.message?.includes("duplicate") ||
        error?.message?.includes("exists")
      ) {
        setFormErrors({ Symbol: "Stock with this symbol already exists" });
      } else {
        setFormErrors({ general: error?.message || "Failed to create stock" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 🔥 FIXED: Edit Stock Function
  const handleEditStock = async () => {
    if (!validateForm() || !editingStock) return;
    setSubmitting(true);

    try {
      console.log(
        "🔄 Updating stock:",
        editingStock._id,
        "with data:",
        formData,
      );

      const updatedStock = await ApiClient.put(
        `/api/stock/${editingStock._id}`,
        {
          Symbol: formData.Symbol,
          StockName: formData.StockName,
          Range: formData.Range,
        },
      );

      console.log("✅ Stock updated successfully:", updatedStock);

      if (updatedStock && updatedStock._id) {
        setIsEditDialogOpen(false);
        setEditingStock(null);
        setFormData({ Symbol: "", StockName: "", Range: 0 });
        setFormErrors({});
        await fetchStocks();
        toast.success(`Stock "${updatedStock.Symbol}" updated successfully!`);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error: any) {
      console.error("❌ Error updating stock:", error);

      if (error?.response?.status === 404) {
        if (error?.message?.includes("not found")) {
          setFormErrors({
            general: "Stock not found. It may have been deleted.",
          });
        } else {
          setFormErrors({ general: "Update stock API not found" });
        }
      } else if (
        error?.message?.includes("duplicate") ||
        error?.message?.includes("exists")
      ) {
        setFormErrors({ Symbol: "Stock with this symbol already exists" });
      } else {
        setFormErrors({ general: error?.message || "Failed to update stock" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 🔥 FIXED: Delete Stock Function
  const handleDeleteStock = async (stockId: string) => {
    try {
      console.log("🔄 Deleting stock:", stockId);

      const response = await ApiClient.delete(`/api/stock/${stockId}`);
      console.log("✅ Delete response:", response);

      await fetchStocks();
      toast.success("Stock deleted successfully!");
    } catch (error: any) {
      console.error("❌ Error deleting stock:", error);

      if (error?.response?.status === 404) {
        if (error?.message?.includes("not found")) {
          toast.error("Stock not found. It may have already been deleted.");
        } else {
          toast.error("Delete stock API not found");
        }
        await fetchStocks();
      } else {
        toast.error(
          "Error deleting stock: " + (error?.message || "Unknown error"),
        );
      }
    }
  };

  // 🔥 FIXED: Delete Multiple Function
  const handleDeleteMultiple = async () => {
    try {
      console.log("🔄 Deleting multiple stocks:", selectedStocks);

      const response = await ApiClient.post("/api/stock/delete-multiple", {
        ids: selectedStocks,
      });

      console.log("✅ Bulk delete response:", response);

      setSelectedStocks([]);
      await fetchStocks();
      toast.success(`${selectedStocks.length} stocks deleted successfully!`);
    } catch (error: any) {
      console.error("❌ Error deleting multiple stocks:", error);

      if (error?.response?.status === 404) {
        toast.error("Bulk delete API not found");
      } else {
        toast.error(
          "Error deleting stocks: " + (error?.message || "Please try again"),
        );
      }

      await fetchStocks();
    }
  };

  const openEditDialog = (stock: Stock) => {
    setEditingStock(stock);
    setFormData({
      Symbol: stock.Symbol,
      StockName: stock.StockName,
      Range: stock.Range,
    });
    setFormErrors({});
    setIsEditDialogOpen(true);
  };

  const closeDialogs = () => {
    setIsCreateDialogOpen(false);
    setIsEditDialogOpen(false);
    setEditingStock(null);
    setFormData({ Symbol: "", StockName: "", Range: 0 });
    setFormErrors({});
  };

  // Pagination functions
  const totalPages = Math.ceil(total / limit);
  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);
  const goToNextPage = () =>
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const goToPreviousPage = () =>
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  const goToPage = (page: number) =>
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));

  const getPageNumbers = () => {
    const delta = 2;
    const start = Math.max(1, currentPage - delta);
    const end = Math.min(totalPages, currentPage + delta);

    const pages = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const openWishlistDialog = (symbol: string, stockId?: string) => {
    setWlSymbol(symbol);
    setWlPendingStockId(stockId || null);
    setWlDialogOpen(true);
  };

  // Bulk add-to-watchlist handler
  const handleBulkWishlistConfirm = async (res: {
    listIds: string[];
    alsoDefault: boolean;
  }) => {
    if (selectedStocks.length === 0) return;
    const ApiUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8090";
    // Add to selected wishlists
    if (res.listIds.length > 0) {
      for (const stockId of selectedStocks) {
        try {
          await fetch(
            `${ApiUrl}/api/wishlist-categories/stocks/add/${stockId}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ categoryIds: res.listIds }),
            },
          );
        } catch (e) {
          // Optionally show error
        }
      }
      toast.success(
        `Added ${selectedStocks.length} stocks to selected watchlists`,
      );
    }
    // Also add to default watchlist if checked
    if (res.alsoDefault) {
      for (const stockId of selectedStocks) {
        try {
          await fetch(`${ApiUrl}/api/stock/watchlist/add/${stockId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          // Optionally show error
        }
      }
      toast.success(
        `Added ${selectedStocks.length} stocks to default watchlist`,
      );
    }
    setBulkWishlistDialogOpen(false);
    setSelectedStocks([]);
    fetchStocks();
  };

  const handleWishlistConfirm = async (res: {
    listIds: string[];
    alsoDefault: boolean;
  }) => {
    const ApiUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8090";
    
    // Add to selected custom wishlists
    if (wlPendingStockId && res.listIds.length > 0) {
      try {
        await fetch(
          `${ApiUrl}/api/wishlist-categories/stocks/add/${wlPendingStockId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ categoryIds: res.listIds }),
          },
        );
        toast.success("Added to selected watchlists");
      } catch (e) {
        toast.error("Failed to add to selected watchlists");
      }
    }
    
    // Also add to default watchlist if checked (using add API, not toggle)
    if (res.alsoDefault && wlPendingStockId) {
      try {
        await fetch(`${ApiUrl}/api/stock/watchlist/add/${wlPendingStockId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        toast.success("Added to default watchlist");
        // Refresh the stocks to reflect changes
        fetchStocks();
      } catch (e) {
        toast.error("Failed to add to default watchlist");
      }
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 lg:p-6">
      <MultiWatchlistDialog
        open={wlDialogOpen}
        onOpenChange={setWlDialogOpen}
        symbol={wlSymbol}
        stockId={wlPendingStockId || ""}
        onConfirm={handleWishlistConfirm}
      />
      {/* RESPONSIVE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
          📊 Stock List Management
        </h1>

        {/* Buttons Container */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          {/* Add Stock Button - Always visible */}
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm order-1">
                <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                Add Stock
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Stock</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="create-symbol">Symbol *</Label>
                  <Input
                    id="create-symbol"
                    value={formData.Symbol}
                    onChange={(e) =>
                      setFormData({ ...formData, Symbol: e.target.value })
                    }
                    placeholder="e.g., NIFTY"
                    className="h-9 text-sm"
                  />
                  {formErrors.Symbol && (
                    <p className="text-sm text-destructive">
                      {formErrors.Symbol}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-name">Stock Name *</Label>
                  <Input
                    id="create-name"
                    value={formData.StockName}
                    onChange={(e) =>
                      setFormData({ ...formData, StockName: e.target.value })
                    }
                    placeholder="e.g., Nifty 50"
                    className="h-9 text-sm"
                  />
                  {formErrors.StockName && (
                    <p className="text-sm text-destructive">
                      {formErrors.StockName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-range">Range *</Label>
                  <Input
                    id="create-range"
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.Range}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        Range: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="e.g., 50"
                    className="h-9 text-sm"
                  />
                  {formErrors.Range && (
                    <p className="text-sm text-destructive">
                      {formErrors.Range}
                    </p>
                  )}
                </div>
                {formErrors.general && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <p className="text-sm text-destructive">
                      {formErrors.general}
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={closeDialogs}
                  className="h-9 text-sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateStock}
                  disabled={submitting}
                  className="h-9 text-sm"
                >
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Stock
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Conditional Action Buttons - Only when stocks are selected */}
          {selectedStocks.length > 0 && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="gap-2 w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm order-2"
                  >
                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                    Delete ({selectedStocks.length})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Selected Stocks</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete {selectedStocks.length}{" "}
                      selected stock(s)? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteMultiple}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button
                variant="secondary"
                className="gap-2 w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm order-3"
                onClick={() => setBulkWishlistDialogOpen(true)}
              >
                <Heart className="h-3 w-3 sm:h-4 sm:w-4 text-pink-600" />
                Add to Watchlist ({selectedStocks.length})
              </Button>

              <MultiWatchlistDialog
                open={bulkWishlistDialogOpen}
                onOpenChange={setBulkWishlistDialogOpen}
                symbol={
                  selectedStocks.length === 1
                    ? stocks.find((s) => s._id === selectedStocks[0])?.Symbol ||
                      ""
                    : `${selectedStocks.length} selected`
                }
                stockId={selectedStocks[0] || ""}
                onConfirm={handleBulkWishlistConfirm}
                defaultAlsoAdd={true}
              />
            </>
          )}
        </div>
      </div>

      {/* RESPONSIVE FILTERS AND SEARCH */}
      <Card>
        <CardHeader className="p-3 sm:pb-6">
          {/* <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
            🔍 Server-Side Search & Filter
          </CardTitle> */}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 sm:top-3 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              <Input
                placeholder="Search stocks..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8 sm:pl-9 h-8 sm:h-10 text-xs sm:text-sm"
              />
            </div>
            <Select
              value={`${sortField}-${sortOrder}`}
              onValueChange={(value) => {
                const [field, order] = value.split("-") as [
                  SortField,
                  SortOrder,
                ];
                setSortField(field);
                setSortOrder(order);
              }}
            >
              <SelectTrigger className="h-8 sm:h-10 text-xs sm:text-sm">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="StockName-asc">📝 Name (A-Z)</SelectItem>
                <SelectItem value="StockName-desc">📝 Name (Z-A)</SelectItem>
                <SelectItem value="Symbol-asc">🏷️ Symbol (A-Z)</SelectItem>
                <SelectItem value="Symbol-desc">🏷️ Symbol (Z-A)</SelectItem>
                <SelectItem value="Range-asc">📊 Range (Low-High)</SelectItem>
                <SelectItem value="Range-desc">📊 Range (High-Low)</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={limit.toString()}
              onValueChange={(value) => setLimit(Number(value))}
            >
              <SelectTrigger className="h-8 sm:h-10 text-xs sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 per page</SelectItem>
                <SelectItem value="10">10 per page</SelectItem>
                <SelectItem value="20">20 per page</SelectItem>
                <SelectItem value="50">50 per page</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all-header"
                checked={
                  selectedStocks.length === stocks.length && stocks.length > 0
                }
                onCheckedChange={(checked) => handleSelectAll(checked === true)}
                className="h-4 w-4"
              />
              <Label htmlFor="select-all-header" className="text-xs sm:text-sm">
                Select All
              </Label>
            </div>
          </div>

          {/* Search & Results Info */}
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              {searchQuery ? (
                <>
                  <Badge variant="outline" className="text-xs">
                    🔍 "{searchQuery}"
                  </Badge>
                  <span>Found {total} results</span>
                </>
              ) : (
                <span>Showing {total} total stocks</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                📊 Sort: {sortField} ({sortOrder})
              </Badge>
              <Badge variant="outline" className="text-xs">
                📄 Page: {currentPage} of {Math.ceil(total / limit)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RESPONSIVE STOCK LIST WITH DYNAMIC LIKE BUTTON */}
      <Card>
        <CardHeader className="p-3 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-base sm:text-lg">
              📋 Stocks ({total} total)
            </CardTitle>
            <div className="text-xs sm:text-sm text-muted-foreground">
              Showing {(currentPage - 1) * limit + 1}-
              {Math.min(currentPage * limit, total)} of {total}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin mr-2" />
              <span className="text-sm sm:text-base">
                Loading from server...
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-100 dark:bg-blue-900">
                    <TableHead className="w-[50px] text-xs sm:text-sm">
                      Select
                    </TableHead>
                    <TableHead className="w-[60px] text-xs sm:text-sm">
                      Watchlist
                    </TableHead>
                    <TableHead
                      className="cursor-pointer text-xs sm:text-sm"
                      onClick={() => handleSort("Symbol")}
                    >
                      <div className="flex items-center gap-2">
                        Symbol {getSortIcon("Symbol")}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer text-xs sm:text-sm"
                      onClick={() => handleSort("StockName")}
                    >
                      <div className="flex items-center gap-2">
                        Stock Name {getSortIcon("StockName")}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer text-xs sm:text-sm"
                      onClick={() => handleSort("Range")}
                    >
                      <div className="flex items-center gap-2">
                        Range {getSortIcon("Range")}
                      </div>
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stocks.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <AlertTriangle className="h-8 w-8 text-muted-foreground/50" />
                          <div className="text-sm sm:text-base">
                            {searchQuery
                              ? `No stocks found matching "${searchQuery}"`
                              : "No stocks found"}
                          </div>
                          {!searchQuery && (
                            <p className="text-xs text-muted-foreground">
                              Try adding some stocks or check your server
                              connection
                            </p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    stocks.map((stock) => (
                      <TableRow key={stock._id} className="hover:bg-gray-50">
                        <TableCell className="p-2 sm:p-4">
                          <Checkbox
                            checked={selectedStocks.includes(stock._id)}
                            onCheckedChange={() =>
                              handleStockSelection(stock._id)
                            }
                            className="h-4 w-4"
                          />
                        </TableCell>
                        <TableCell className="p-2 sm:p-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              openWishlistDialog(stock.Symbol, stock._id)
                            }
                            disabled={updatingWatchlistIds.has(stock._id)}
                            className="h-6 w-6 sm:h-8 sm:w-8 p-0 relative"
                            title={
                              stock.isWatchlist
                                ? "Remove from watchlist"
                                : "Add to watchlist"
                            }
                          >
                            {stock.isWatchlist ? (
                              <Heart className="h-3 w-3 sm:h-4 sm:w-4 fill-red-500 text-red-500" />
                            ) : (
                              <HeartOff className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                            )}

                            {updatingWatchlistIds.has(stock._id) && (
                              <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded">
                                <Loader2 className="h-2 w-2 sm:h-3 sm:w-3 animate-spin text-blue-600" />
                              </div>
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="p-2 sm:p-4">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const sym = stock.Symbol.replace(/\.NS$/, "");
                                const tvUrl = `https://in.tradingview.com/chart/?symbol=NSE%3A${encodeURIComponent(sym)}`;
                                window.open(
                                  tvUrl,
                                  "_blank",
                                  "noopener,noreferrer",
                                );
                              }}
                              title="Open in TradingView"
                              className="inline-flex items-center gap-1 hover:opacity-80 mr-1"
                            >
                              <img
                                src="https://static.tradingview.com/static/images/favicon.ico"
                                alt="TV"
                                className="h-3 w-3"
                              />
                            </button>
                            <Badge
                              variant="secondary"
                              className="text-xs px-2 py-1"
                            >
                              {stock.Symbol}
                            </Badge>
                            {[
                              "NIFTY",
                              "BANKNIFTY",
                              "CNXFINANCE",
                              "MIDCPNIFTY1!",
                            ].includes(stock.Symbol) && (
                              <Badge
                                variant="outline"
                                className="text-xs px-1 py-0.5 bg-primary/10"
                              >
                                ⭐
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium p-2 sm:p-4 text-xs sm:text-sm">
                          {stock.StockName}
                        </TableCell>
                        <TableCell className="p-2 sm:p-4 text-xs sm:text-sm">
                          {stock.Range}
                        </TableCell>
                        <TableCell className="p-2 sm:p-4">
                          <div className="flex gap-1 sm:gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(stock)}
                              className="h-6 w-6 sm:h-8 sm:w-8 p-0"
                              title="Edit Stock"
                            >
                              <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 sm:h-8 sm:w-8 p-0 text-destructive"
                                  title="Delete Stock"
                                >
                                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete Stock
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "
                                    {stock.StockName}" ({stock.Symbol})? This
                                    action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteStock(stock._id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* RESPONSIVE PAGINATION CONTROLS */}
          {!loading && total > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 p-4 sm:p-0">
              <div className="text-xs sm:text-sm text-muted-foreground order-2 sm:order-1">
                Page {currentPage} of {totalPages} ({total} total records)
              </div>

              <div className="flex items-center gap-1 sm:gap-2 order-1 sm:order-2 flex-wrap justify-center">
                {/* First Page */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToFirstPage}
                  disabled={currentPage === 1}
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                >
                  <ChevronsLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>

                {/* Previous Page */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                >
                  <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>

                {/* Page Numbers */}
                {getPageNumbers().map((pageNum) => (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => goToPage(pageNum)}
                    className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-xs sm:text-sm"
                  >
                    {pageNum}
                  </Button>
                ))}

                {/* Next Page */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                >
                  <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>

                {/* Last Page */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToLastPage}
                  disabled={currentPage === totalPages}
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                >
                  <ChevronsRight className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-symbol">Symbol *</Label>
              <Input
                id="edit-symbol"
                value={formData.Symbol}
                onChange={(e) =>
                  setFormData({ ...formData, Symbol: e.target.value })
                }
                placeholder="e.g., NIFTY"
                className="h-9 text-sm"
              />
              {formErrors.Symbol && (
                <p className="text-sm text-destructive">{formErrors.Symbol}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Stock Name *</Label>
              <Input
                id="edit-name"
                value={formData.StockName}
                onChange={(e) =>
                  setFormData({ ...formData, StockName: e.target.value })
                }
                placeholder="e.g., Nifty 50"
                className="h-9 text-sm"
              />
              {formErrors.StockName && (
                <p className="text-sm text-destructive">
                  {formErrors.StockName}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-range">Range *</Label>
              <Input
                id="edit-range"
                type="number"
                step="0.1"
                min="0"
                value={formData.Range}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    Range: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="e.g., 50"
                className="h-9 text-sm"
              />
              {formErrors.Range && (
                <p className="text-sm text-destructive">{formErrors.Range}</p>
              )}
            </div>
            {formErrors.general && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <p className="text-sm text-destructive">{formErrors.general}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeDialogs}
              className="h-9 text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditStock}
              disabled={submitting}
              className="h-9 text-sm"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
