import { useState, useEffect, useCallback } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Heart,
  Star,
  TrendingUp,
  TrendingDown,
  Eye,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Edit,
  RotateCcw as RecycleBin,
  Check,
  X,
  Plus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// 🔥 Custom hook for debouncing search input
function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

interface Stock {
  _id: string;
  Symbol: string;
  StockName: string;
  Range: number;
  isWatchlist: boolean;
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
}

interface MarketPrice {
  regularMarketPrice: number;
  currency: string;
  chartPreviousClose: number;
  regularMarketDayLow: number;
  regularMarketDayHigh: number;
  fiftyTwoWeekLow: number;
  fiftyTwoWeekHigh: number;
  error?: boolean;
  message?: string;
}

interface WatchlistAPIResponse {
  success: boolean;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  data: Stock[];
  searchQuery: string;
  resultsCount: number;
}

// 🔥 NEW: Backend Watchlist Category Interface
interface WatchlistCategory {
  _id: string;
  name: string;
  userId: string;
  stocks: Stock[];
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
}

interface WatchlistCategoryResponse {
  success: boolean;
  data: WatchlistCategory[];
  total?: number;
}

type SortField = "Symbol" | "StockName" | "Range" | "createdAt" | "updatedAt";
type SortOrder = "asc" | "desc";

export default function Watchlist() {
  const navigate = useNavigate();
  const [watchlistStocks, setWatchlistStocks] = useState<Stock[]>([]);
  const [marketPrices, setMarketPrices] = useState<Record<string, MarketPrice>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [refreshingStocks, setRefreshingStocks] = useState<Set<string>>(
    new Set(),
  );
  const [updatingWatchlistIds, setUpdatingWatchlistIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);

  // 🔥 UPDATED: Backend integrated watchlist categories
  const [watchlistCategories, setWatchlistCategories] = useState<
    WatchlistCategory[]
  >([]);
  const [deletedCategories, setDeletedCategories] = useState<
    WatchlistCategory[]
  >([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedWatchlistId, setSelectedWatchlistId] =
    useState<string>("default");
  const [editingWatchlistId, setEditingWatchlistId] = useState<string | null>(
    null,
  );
  const [editingName, setEditingName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>(
    {},
  );
  const [defaultCount, setDefaultCount] = useState(0);

  // Server-side filtering and pagination only for default watchlist
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("StockName");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);

  const ApiUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8090";
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // 🔥 BACKEND: Fetch watchlist categories
  const fetchWatchlistCategories = useCallback(async () => {
    try {
      const response: WatchlistCategoryResponse = await ApiClient.get(
        "/api/wishlist-categories",
      );
      if (response.success && Array.isArray(response.data)) {
        const activeCategories = response.data.filter((cat) => !cat.isDeleted);
        const deletedCategories = response.data.filter((cat) => cat.isDeleted);
        setWatchlistCategories(activeCategories);
        setDeletedCategories(deletedCategories);

        // Fetch counts for each active category (fast: limit=1 to read total)
        try {
          const results = await Promise.all(
            activeCategories.map((cat) =>
              ApiClient.get(
                `/api/wishlist-categories/stocks/${cat._id}?page=1&limit=1`,
              ),
            ),
          );
          const map: Record<string, number> = {};
          results.forEach((res: any, idx) => {
            const id = activeCategories[idx]._id;
            map[id] =
              res && typeof res.total === "number"
                ? res.total
                : Array.isArray(res?.data)
                  ? res.data.length
                  : 0;
          });
          setCategoryCounts(map);
        } catch (e) {
          console.warn("Could not fetch category counts");
        }

        // Fetch default watchlist total count
        try {
          const defRes: any = await ApiClient.get(
            `/api/stock/watchlist?page=1&limit=1`,
          );
          setDefaultCount(
            typeof defRes?.total === "number"
              ? defRes.total
              : Array.isArray(defRes?.data)
                ? defRes.data.length
                : 0,
          );
        } catch (e) {
          // ignore
        }
      }
    } catch (error) {
      console.error("Error fetching watchlist categories:", error);
      toast.error("Failed to load watchlist categories");
    }
  }, []);

  // 🔥 BACKEND: Create new watchlist category
  const createWatchlistCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      toast.error("Please enter a watchlist name");
      return;
    }

    // Check for duplicate names
    const existingNames = watchlistCategories.map((cat) =>
      cat.name.toLowerCase(),
    );
    if (existingNames.includes(name.toLowerCase())) {
      toast.error(
        "A watchlist with this name already exists. Please choose a different name.",
      );
      return;
    }

    setCreatingCategory(true);
    try {
      const response = await ApiClient.post("/api/wishlist-categories", {
        name,
      });
      if (response.success) {
        await fetchWatchlistCategories();
        setNewCategoryName("");
        toast.success(`Watchlist "${name}" created successfully!`);
      }
    } catch (error: any) {
      console.error("Error creating watchlist category:", error);
      if (error?.response?.data?.message?.includes("already exists")) {
        toast.error("A watchlist with this name already exists");
      } else {
        toast.error(
          "Watchlist limit reached! You've created the maximum number of watchlists. Please delete an existing one to create a new watchlist.",
        );
      }
    } finally {
      setCreatingCategory(false);
    }
  };

  // 🔥 BACKEND: Update watchlist category name
  const updateWatchlistCategory = async (id: string, newName: string) => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      toast.error("Please enter a valid name");
      return;
    }

    // Check for duplicate names
    const existingNames = watchlistCategories
      .filter((cat) => cat._id !== id)
      .map((cat) => cat.name.toLowerCase());

    if (existingNames.includes(trimmedName.toLowerCase())) {
      toast.error(
        "A watchlist with this name already exists. Please choose a different name.",
      );
      return;
    }

    try {
      const response = await ApiClient.put(`/api/wishlist-categories/${id}`, {
        name: trimmedName,
      });
      if (response.success) {
        await fetchWatchlistCategories();
        setEditingWatchlistId(null);
        setEditingName("");
        toast.success("Watchlist name updated successfully!");
      }
    } catch (error: any) {
      console.error("Error updating watchlist category:", error);
      if (error?.response?.data?.message?.includes("already exists")) {
        toast.error("A watchlist with this name already exists");
      } else {
        toast.error("Failed to update watchlist category");
      }
    }
  };

  // 🔥 BACKEND: Delete watchlist category (soft delete)
  const deleteWatchlistCategory = async (id: string) => {
    try {
      const response = await ApiClient.delete(`/api/wishlist-categories/${id}`);
      if (response.success) {
        await fetchWatchlistCategories();

        // If currently viewing this watchlist, switch to default
        if (selectedWatchlistId === id) {
          setSelectedWatchlistId("default");
        }

        const deletedCategory = watchlistCategories.find(
          (cat) => cat._id === id,
        );
        toast.success(
          `Watchlist "${deletedCategory?.name}" moved to recycle bin`,
        );
      }
    } catch (error) {
      console.error("Error deleting watchlist category:", error);
      toast.error("Failed to delete watchlist category");
    }
  };

  // 🔥 BACKEND: Restore watchlist category from recycle bin
  const restoreWatchlistCategory = async (id: string) => {
    try {
      const response = await ApiClient.put(
        `/api/wishlist-categories/${id}/restore`,
      );
      if (response.success) {
        await fetchWatchlistCategories();
        const restoredCategory = deletedCategories.find(
          (cat) => cat._id === id,
        );
        toast.success(
          `Watchlist "${restoredCategory?.name}" restored successfully!`,
        );
      }
    } catch (error: any) {
      console.error("Error restoring watchlist category:", error);
      if (error?.response?.data?.message?.includes("already exists")) {
        toast.error(
          "Cannot restore: A watchlist with this name already exists",
        );
      } else {
        toast.error("Failed to restore watchlist category");
      }
    }
  };

  // 🔥 BACKEND: Permanently delete watchlist category
  const permanentlyDeleteCategory = async (id: string) => {
    try {
      const response = await ApiClient.delete(
        `/api/wishlist-categories/${id}/permanent`,
      );
      if (response.success) {
        await fetchWatchlistCategories();
        const deletedCategory = deletedCategories.find((cat) => cat._id === id);
        toast.success(
          `Watchlist "${deletedCategory?.name}" permanently deleted`,
        );
      }
    } catch (error) {
      console.error("Error permanently deleting watchlist category:", error);
      toast.error("Failed to permanently delete watchlist category");
    }
  };

  // 🔥 BACKEND: Add stock to watchlist category
  const addStockToWatchlistCategory = async (
    categoryId: string,
    stockId: string,
  ) => {
    try {
      const response = await ApiClient.post(
        `/api/wishlist-categories/stocks/add/${stockId}`,
        { categoryIds: [categoryId] },
      );
      if (response.success) {
        if (selectedWatchlistId === categoryId) {
          await handleTabChange(categoryId);
        }
        // Update count for this category
        try {
          const res: any = await ApiClient.get(
            `/api/wishlist-categories/stocks/${categoryId}?page=1&limit=1`,
          );
          setCategoryCounts((prev) => ({
            ...prev,
            [categoryId]:
              typeof res?.total === "number"
                ? res.total
                : Array.isArray(res?.data)
                  ? res.data.length
                  : prev[categoryId] || 0,
          }));
        } catch {}
        toast.success("Stock added to watchlist successfully!");
      }
    } catch (error: any) {
      console.error("Error adding stock to watchlist category:", error);
      if (error?.response?.data?.message?.includes("already exists")) {
        toast.error("Stock already exists in this watchlist");
      } else {
        toast.error("Failed to add stock to watchlist");
      }
    }
  };

  // 🔥 BACKEND: Remove stock from watchlist category
  const removeStockFromWatchlistCategory = async (
    categoryId: string,
    stockId: string,
  ) => {
    try {
      const response = await ApiClient.fetch(
        `/api/wishlist-categories/stocks/remove/${stockId}`,
        {
          method: "DELETE",
          body: JSON.stringify({ categoryIds: [categoryId] }),
        },
      );
      if (response.success) {
        if (selectedWatchlistId === categoryId) {
          await handleTabChange(categoryId);
        }
        // Update count for this category
        try {
          const res: any = await ApiClient.get(
            `/api/wishlist-categories/stocks/${categoryId}?page=1&limit=1`,
          );
          setCategoryCounts((prev) => ({
            ...prev,
            [categoryId]:
              typeof res?.total === "number"
                ? res.total
                : Array.isArray(res?.data)
                  ? res.data.length
                  : prev[categoryId] || 0,
          }));
        } catch {}
        setSelectedStocks((prev) => prev.filter((id) => id !== stockId));
        toast.success("Stock removed from watchlist successfully!");
      }
    } catch (error) {
      console.error("Error removing stock from watchlist category:", error);
      toast.error("Failed to remove stock from watchlist");
    }
  };

  // SERVER-SIDE: Fetch default watchlist stocks with search, sorting, and pagination
  const fetchWatchlistStocks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        sortField,
        sortOrder,
      });

      if (debouncedSearchQuery.trim()) {
        params.append("search", debouncedSearchQuery.trim());
      }

      const response: WatchlistAPIResponse = await ApiClient.get(
        `/api/stock/watchlist?${params.toString()}`,
      );

      if (response && response.success && Array.isArray(response.data)) {
        setWatchlistStocks(response.data);
        const t = response.total || 0;
        setTotal(t);
        setDefaultCount(t);
        setTotalPages(response.totalPages || 0);
        setHasNextPage(response.hasNextPage || false);
        setHasPrevPage(response.hasPrevPage || false);
      } else {
        setWatchlistStocks([]);
        setTotal(0);
        setTotalPages(0);
        setHasNextPage(false);
        setHasPrevPage(false);
      }
    } catch (error) {
      console.error("❌ Error fetching watchlist stocks:", error);
      setWatchlistStocks([]);
      setTotal(0);
      setTotalPages(0);
      setHasNextPage(false);
      setHasPrevPage(false);
      if (error instanceof Error) {
        toast.error("Error loading watchlist: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit, debouncedSearchQuery, sortField, sortOrder]);

  // Initialize data
  useEffect(() => {
    fetchWatchlistCategories();
  }, [fetchWatchlistCategories]);

  // Fetch data when dependencies change (for all watchlists)
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      if (selectedWatchlistId === "default") {
        await fetchWatchlistStocks();
      } else {
        try {
          const params = new URLSearchParams({
            page: currentPage.toString(),
            limit: limit.toString(),
            sortField,
            sortOrder,
          });
          if (debouncedSearchQuery.trim()) {
            params.append("search", debouncedSearchQuery.trim());
          }
          const response: any = await ApiClient.get(
            `/api/wishlist-categories/stocks/${selectedWatchlistId}?${params.toString()}`,
          );
          if (response.success && Array.isArray(response.data)) {
            setWatchlistStocks(response.data);
            if (typeof response.total === "number") {
              setCategoryCounts((prev) => ({
                ...prev,
                [selectedWatchlistId]: response.total,
              }));
              setTotal(response.total);
              setTotalPages(response.totalPages || 0);
              setHasNextPage(response.hasNextPage || false);
              setHasPrevPage(response.hasPrevPage || false);
            } else {
              setTotal(response.data.length);
              setTotalPages(1);
              setHasNextPage(false);
              setHasPrevPage(false);
            }
          } else {
            setWatchlistStocks([]);
            setTotal(0);
            setTotalPages(0);
            setHasNextPage(false);
            setHasPrevPage(false);
          }
        } catch (error) {
          console.error("Error fetching watchlist category:", error);
          setWatchlistStocks([]);
          setTotal(0);
          setTotalPages(0);
          setHasNextPage(false);
          setHasPrevPage(false);
          toast.error("Failed to load watchlist data");
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [
    fetchWatchlistStocks,
    selectedWatchlistId,
    currentPage,
    limit,
    debouncedSearchQuery,
    sortField,
    sortOrder,
  ]);

  // Handle tab change: just update tab, reset selection, page, and search
  const handleTabChange = (value: string) => {
    setSelectedWatchlistId(value);
    setSelectedStocks([]);
    setCurrentPage(1);
    setSearchQuery("");
  };

  // Reset to first page when search, sort, or watchlist changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, sortField, sortOrder, selectedWatchlistId]);

  const getCurrentWatchlistName = () => {
    if (selectedWatchlistId === "default") return "Default Watchlist";
    const category = watchlistCategories.find(
      (cat) => cat._id === selectedWatchlistId,
    );
    return category ? category.name : "Unknown Watchlist";
  };

  const getCurrentWatchlistCategory = () => {
    if (selectedWatchlistId === "default") return null;
    return watchlistCategories.find((cat) => cat._id === selectedWatchlistId);
  };

  // Fetch market price
  const fetchMarketPrice = useCallback(
    async (symbol: string, isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshingStocks((prev) => new Set(prev).add(symbol));
      }

      try {
        const response = await fetch(
          `${ApiUrl}/api/marketprice-stock/${symbol}/1d`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch price for ${symbol}`);
        }

        const data = await response.json();
        if (data.chart?.result?.[0]?.meta) {
          const marketPrice = data.chart.result[0].meta;
          setMarketPrices((prevPrices) => ({
            ...prevPrices,
            [symbol]: marketPrice,
          }));
        } else {
          setMarketPrices((prevPrices) => ({
            ...prevPrices,
            [symbol]: {
              error: true,
              message: "No data available",
              regularMarketPrice: 0,
              currency: "INR",
              chartPreviousClose: 0,
              regularMarketDayLow: 0,
              regularMarketDayHigh: 0,
              fiftyTwoWeekLow: 0,
              fiftyTwoWeekHigh: 0,
            },
          }));
        }
      } catch (error) {
        setMarketPrices((prevPrices) => ({
          ...prevPrices,
          [symbol]: {
            error: true,
            message:
              error instanceof Error ? error.message : "Failed to fetch price",
            regularMarketPrice: 0,
            currency: "INR",
            chartPreviousClose: 0,
            regularMarketDayLow: 0,
            regularMarketDayHigh: 0,
            fiftyTwoWeekLow: 0,
            fiftyTwoWeekHigh: 0,
          },
        }));
      } finally {
        if (isManualRefresh) {
          setRefreshingStocks((prev) => {
            const newSet = new Set(prev);
            newSet.delete(symbol);
            return newSet;
          });
        }
      }
    },
    [ApiUrl],
  );

  // Fetch market prices for all watchlist stocks
  useEffect(() => {
    if (Array.isArray(watchlistStocks) && watchlistStocks.length > 0) {
      watchlistStocks.forEach((stock, index) => {
        if (stock && stock.Symbol) {
          setTimeout(() => {
            fetchMarketPrice(stock.Symbol);
          }, index * 1000);
        }
      });
    }
  }, [watchlistStocks, fetchMarketPrice]);

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
      } else {
        setSortField(field);
        setSortOrder("asc");
      }
    },
    [sortField, sortOrder],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
      }
    },
    [totalPages],
  );

  const getSortIcon = useCallback(
    (field: SortField) => {
      if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
      return sortOrder === "asc" ? (
        <ArrowUp className="h-4 w-4" />
      ) : (
        <ArrowDown className="h-4 w-4" />
      );
    },
    [sortField, sortOrder],
  );

  const getPriceChange = useCallback(
    (symbol: string) => {
      const marketData = marketPrices[symbol];
      if (!marketData || marketData.error) return 0;
      return marketData.regularMarketPrice - marketData.chartPreviousClose;
    },
    [marketPrices],
  );

  const getPriceChangePercent = useCallback(
    (symbol: string) => {
      const marketData = marketPrices[symbol];
      if (
        !marketData ||
        marketData.error ||
        marketData.chartPreviousClose === 0
      )
        return 0;
      const change =
        marketData.regularMarketPrice - marketData.chartPreviousClose;
      return (change / marketData.chartPreviousClose) * 100;
    },
    [marketPrices],
  );

  const removeFromWatchlist = useCallback(
    async (stockId: string) => {
      if (updatingWatchlistIds.has(stockId)) return;
      setUpdatingWatchlistIds((prev) => new Set(prev).add(stockId));

      try {
        if (selectedWatchlistId === "default") {
          const response = await ApiClient.patch(
            `/api/stock/watchlist/${stockId}`,
          );
          if (response && response._id) {
            // 🔥 IMMEDIATE STATE UPDATE - Remove stock locally first
            setWatchlistStocks((prevStocks) =>
              prevStocks.filter((stock) => stock._id !== stockId),
            );
            setTotal((prev) => prev - 1);
            setDefaultCount((prev) => prev - 1);

            // Then refresh from server (optional for data consistency)
            await fetchWatchlistStocks();

            setSelectedStocks((prev) => prev.filter((id) => id !== stockId));
            toast.success("Stock removed from watchlist successfully!");
          }
        } else {
          // 🔥 IMMEDIATE STATE UPDATE for custom watchlist too
          setWatchlistStocks((prevStocks) =>
            prevStocks.filter((stock) => stock._id !== stockId),
          );
          setCategoryCounts((prev) => ({
            ...prev,
            [selectedWatchlistId]: Math.max(
              0,
              (prev[selectedWatchlistId] || 0) - 1,
            ),
          }));
          setTotal((prev) => Math.max(0, prev - 1));

          await removeStockFromWatchlistCategory(selectedWatchlistId, stockId);
        }
      } catch (error) {
        console.error("❌ Error removing from watchlist:", error);

        // 🔥 REVERT STATE on error - refetch data
        if (selectedWatchlistId === "default") {
          await fetchWatchlistStocks();
        } else {
          await handleTabChange(selectedWatchlistId);
        }

        toast.error(
          `Error: ${error instanceof Error ? error.message : "Failed to remove from watchlist"}`,
        );
      } finally {
        setUpdatingWatchlistIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(stockId);
          return newSet;
        });
      }
    },
    [
      updatingWatchlistIds,
      fetchWatchlistStocks,
      selectedWatchlistId,
      removeStockFromWatchlistCategory,
      handleTabChange, // Add this dependency
    ],
  );

  const handleStockSelection = useCallback((stockId: string) => {
    setSelectedStocks((prev) =>
      prev.includes(stockId)
        ? prev.filter((id) => id !== stockId)
        : [...prev, stockId],
    );
  }, []);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      const safeStocks = Array.isArray(watchlistStocks) ? watchlistStocks : [];
      setSelectedStocks(
        checked ? safeStocks.map((stock) => stock._id).filter(Boolean) : [],
      );
    },
    [watchlistStocks],
  );

  const handleStockRefresh = useCallback(
    (symbol: string) => {
      fetchMarketPrice(symbol, true);
    },
    [fetchMarketPrice],
  );

  const clearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  const getPageNumbers = useCallback(() => {
    const delta = 2;
    const start = Math.max(1, currentPage - delta);
    const end = Math.min(totalPages, currentPage + delta);
    const pages = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [currentPage, totalPages]);

  // Safe arrays for rendering
  const safeWatchlistCategories = Array.isArray(watchlistCategories)
    ? watchlistCategories
    : [];
  const safeDeletedCategories = Array.isArray(deletedCategories)
    ? deletedCategories
    : [];
  const safeWatchlistStocks = Array.isArray(watchlistStocks)
    ? watchlistStocks
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          📋 My Watchlist
        </h1>
        <div className="flex gap-2">
          {/* <Button
            onClick={() => navigate("/recycle-bin")}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RecycleBin className="h-4 w-4" />
            Recycle Bin ({safeDeletedCategories.length})
          </Button> */}
          <Button
            onClick={fetchWatchlistStocks}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "🔄"}
            Refresh
          </Button>
        </div>
      </div>

      {/* Create Custom Watchlist */}
      <Card>
        {/* <CardHeader className="p-3 sm:pb-6">
          <CardTitle className="text-base sm:text-lg">
            📁 Create New Watchlist
          </CardTitle>
        </CardHeader> */}
        <CardContent>
          <div className="flex items-end mt-3 gap-2">
            <div className="flex-1">
              <Label htmlFor="new-category-name">
                Watchlist name (Note: You can add only 6 watchlist)
              </Label>
              <Input
                id="new-category-name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., Momentum Picks"
                onKeyPress={(e) =>
                  e.key === "Enter" && createWatchlistCategory()
                }
                disabled={creatingCategory}
              />
            </div>
            <Button
              onClick={createWatchlistCategory}
              disabled={!newCategoryName.trim() || creatingCategory}
            >
              {creatingCategory ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Server-Side Search and Filter (All Watchlists) */}
      <Card>
        <CardHeader></CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1 relative w-full">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search stocks..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 pr-10"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="absolute right-2 top-1 h-8 w-8 p-0"
                  title="Clear search"
                >
                  ✕
                </Button>
              )}
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
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="StockName-asc">📝 Name (A-Z)</SelectItem>
                <SelectItem value="StockName-desc">📝 Name (Z-A)</SelectItem>
                <SelectItem value="Symbol-asc">🏷️ Symbol (A-Z)</SelectItem>
                <SelectItem value="Symbol-desc">🏷️ Symbol (Z-A)</SelectItem>
                <SelectItem value="Range-asc">📊 Range (Low-High)</SelectItem>
                <SelectItem value="Range-desc">📊 Range (High-Low)</SelectItem>
                <SelectItem value="createdAt-desc">🕒 Newest First</SelectItem>
                <SelectItem value="createdAt-asc">🕒 Oldest First</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={limit.toString()}
              onValueChange={(value) => setLimit(Number(value))}
            >
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 per page</SelectItem>
                <SelectItem value="10">10 per page</SelectItem>
                <SelectItem value="20">20 per page</SelectItem>
                <SelectItem value="50">50 per page</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              {debouncedSearchQuery ? (
                <>
                  <Badge variant="outline" className="text-xs">
                    "{debouncedSearchQuery}"
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
                📄 Page: {currentPage}/{totalPages}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Watchlist Tabs and Content */}
      <Card>
        <CardContent className="p-0">
          <Tabs
            value={selectedWatchlistId}
            onValueChange={handleTabChange}
            className="w-full"
          >
            <div className="border-b">
              <div className="overflow-x-auto no-scrollbar">
                <TabsList className="w-max justify-start rounded-none bg-transparent p-0 h-auto min-w-full">
                  <TabsTrigger
                    value="default"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent px-6 py-3 whitespace-nowrap flex-shrink-0"
                  >
                    <Star className="h-4 w-4 mr-2" />
                    Default ({defaultCount})
                  </TabsTrigger>
                  {safeWatchlistCategories.map((category) => (
                    <TabsTrigger
                      key={category._id}
                      value={category._id}
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent px-6 py-3 whitespace-nowrap flex-shrink-0"
                    >
                      <Heart className="h-4 w-4 mr-2" />
                      {category.name} ({categoryCounts[category._id] ?? 0})
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </div>

            <TabsContent value={selectedWatchlistId} className="mt-0">
              <div className="p-6">
                {/* Watchlist Actions (for custom watchlists only) */}
                {selectedWatchlistId !== "default" &&
                  getCurrentWatchlistCategory() && (
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">
                          {getCurrentWatchlistName()}
                        </h3>
                        <Badge variant="outline">
                          {safeWatchlistStocks.length} stocks
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {editingWatchlistId === selectedWatchlistId ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="h-8 w-48"
                              onKeyPress={(e) => {
                                if (e.key === "Enter")
                                  updateWatchlistCategory(
                                    selectedWatchlistId,
                                    editingName,
                                  );
                                if (e.key === "Escape") {
                                  setEditingWatchlistId(null);
                                  setEditingName("");
                                }
                              }}
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={() =>
                                updateWatchlistCategory(
                                  selectedWatchlistId,
                                  editingName,
                                )
                              }
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingWatchlistId(null);
                                setEditingName("");
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingWatchlistId(selectedWatchlistId);
                                setEditingName(getCurrentWatchlistName());
                              }}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Name
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Watchlist
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete Watchlist
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "
                                    {getCurrentWatchlistName()}"? It will be
                                    moved to recycle bin and can be restored
                                    later.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      deleteWatchlistCategory(
                                        selectedWatchlistId,
                                      )
                                    }
                                    className="bg-red-600 text-white hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                {/* Watchlist Table */}
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Loading watchlist...</span>
                  </div>
                ) : safeWatchlistStocks.length === 0 ? (
                  <div className="text-center py-12">
                    <Star className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">
                      No Records Available
                    </h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      {selectedWatchlistId === "default"
                        ? "No stocks found in your default watchlist. Start adding stocks from the Stock List page."
                        : `No stocks found in "${getCurrentWatchlistName()}". Add some stocks to get started.`}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="select-all-watchlist"
                          checked={
                            selectedStocks.length ===
                              safeWatchlistStocks.length &&
                            safeWatchlistStocks.length > 0
                          }
                          onCheckedChange={(checked) =>
                            handleSelectAll(checked === true)
                          }
                        />
                        <Label
                          htmlFor="select-all-watchlist"
                          className="text-sm"
                        >
                          Select All
                        </Label>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {selectedStocks.length > 0 &&
                          `${selectedStocks.length} selected`}
                      </div>
                    </div>

                    <ScrollArea className="h-[600px] w-full">
                      <div className="min-w-[800px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[50px]">Select</TableHead>
                              <TableHead
                                className="cursor-pointer"
                                onClick={() => handleSort("Symbol")}
                              >
                                <div className="flex items-center gap-2">
                                  Symbol {getSortIcon("Symbol")}
                                </div>
                              </TableHead>
                              <TableHead
                                className="cursor-pointer"
                                onClick={() => handleSort("StockName")}
                              >
                                <div className="flex items-center gap-2">
                                  Stock Name {getSortIcon("StockName")}
                                </div>
                              </TableHead>
                              <TableHead>Price</TableHead>
                              <TableHead>Change</TableHead>
                              <TableHead
                                className="cursor-pointer"
                                onClick={() => handleSort("Range")}
                              >
                                <div className="flex items-center gap-2">
                                  Range {getSortIcon("Range")}
                                </div>
                              </TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {safeWatchlistStocks.map((stock) => {
                              if (!stock || !stock._id) return null;

                              const marketData = marketPrices[stock.Symbol];
                              const priceChange = getPriceChange(stock.Symbol);
                              const priceChangePercent = getPriceChangePercent(
                                stock.Symbol,
                              );
                              const isRefreshing = refreshingStocks.has(
                                stock.Symbol,
                              );
                              const isUpdatingWatchlist =
                                updatingWatchlistIds.has(stock._id);

                              return (
                                <TableRow key={stock._id}>
                                  <TableCell>
                                    <Checkbox
                                      checked={selectedStocks.includes(
                                        stock._id,
                                      )}
                                      onCheckedChange={() =>
                                        handleStockSelection(stock._id)
                                      }
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const sym = stock.Symbol.replace(
                                          /\.NS$/,
                                          "",
                                        );
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
                                    <Badge variant="secondary">
                                      {stock.Symbol}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {stock.StockName}
                                  </TableCell>
                                  <TableCell>
                                    {marketData ? (
                                      marketData.error ? (
                                        <span className="text-sm text-destructive">
                                          ❌ Error
                                        </span>
                                      ) : (
                                        <span className="text-lg font-bold">
                                          ₹
                                          {marketData.regularMarketPrice.toFixed(
                                            2,
                                          )}
                                        </span>
                                      )
                                    ) : (
                                      <span className="text-sm text-muted-foreground">
                                        Loading...
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {marketData &&
                                    !marketData.error &&
                                    priceChange !== 0 ? (
                                      <div className="flex items-center gap-1">
                                        {priceChange > 0 ? (
                                          <TrendingUp className="h-4 w-4 text-green-600" />
                                        ) : (
                                          <TrendingDown className="h-4 w-4 text-red-600" />
                                        )}
                                        <div className="flex flex-col">
                                          <span
                                            className={`text-sm font-medium ${
                                              priceChange > 0
                                                ? "text-green-600"
                                                : "text-red-600"
                                            }`}
                                          >
                                            {priceChange > 0 ? "+" : ""}
                                            {priceChange.toFixed(2)}
                                          </span>
                                          <span
                                            className={`text-xs ${
                                              priceChange > 0
                                                ? "text-green-600"
                                                : "text-red-600"
                                            }`}
                                          >
                                            ({priceChangePercent > 0 ? "+" : ""}
                                            {priceChangePercent.toFixed(2)}%)
                                          </span>
                                        </div>
                                      </div>
                                    ) : (
                                      <div>
                                        <span className="text-sm text-muted-foreground">
                                          -
                                        </span>
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>{stock.Range}</TableCell>
                                  <TableCell>
                                    <div className="flex gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          handleStockRefresh(stock.Symbol)
                                        }
                                        disabled={isRefreshing}
                                        className="h-8 w-8 p-0"
                                        title="Refresh Price"
                                      >
                                        {isRefreshing ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <RotateCcw className="h-3 w-3" />
                                        )}
                                      </Button>

                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-destructive"
                                            disabled={isUpdatingWatchlist}
                                            title="Remove from Watchlist"
                                          >
                                            {isUpdatingWatchlist ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <Trash2 className="h-4 w-4" />
                                            )}
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>
                                              Remove from Watchlist
                                            </AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Are you sure you want to remove "
                                              {stock.StockName}" ({stock.Symbol}
                                              ) from this watchlist?
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>
                                              Cancel
                                            </AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() =>
                                                removeFromWatchlist(stock._id)
                                              }
                                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                              Remove
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </ScrollArea>

                    {/* Pagination (for all watchlists with multiple pages) */}
                    {totalPages > 1 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                        <div className="text-sm text-muted-foreground">
                          Page {currentPage} of {totalPages} ({total} total
                          stocks)
                          {selectedWatchlistId !== "default" &&
                            ` in ${getCurrentWatchlistName()}`}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(1)}
                            disabled={!hasPrevPage || loading}
                            className="h-8 w-8 p-0"
                            title="First page"
                          >
                            <ChevronsLeft className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={!hasPrevPage || loading}
                            className="h-8 w-8 p-0"
                            title="Previous page"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>

                          {getPageNumbers().map((pageNum) => (
                            <Button
                              key={pageNum}
                              variant={
                                currentPage === pageNum ? "default" : "outline"
                              }
                              size="sm"
                              onClick={() => handlePageChange(pageNum)}
                              disabled={loading}
                              className="h-8 w-8 p-0"
                              title={`Go to page ${pageNum}`}
                            >
                              {pageNum}
                            </Button>
                          ))}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={!hasNextPage || loading}
                            className="h-8 w-8 p-0"
                            title="Next page"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(totalPages)}
                            disabled={!hasNextPage || loading}
                            className="h-8 w-8 p-0"
                            title="Last page"
                          >
                            <ChevronsRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
