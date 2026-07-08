import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ApiClient from "@/lib/apiClient";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import MultiWatchlistDialog from "@/components/MultiWatchlistDialog";
import {
  Search,
  Activity,
  Loader2,
  Heart,
  HeartOff,
  Play,
  Star,
  ArrowUpDown,
  ArrowDownAZ,
  ArrowUpZA,
  Clock,
  RotateCcw,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface Stock {
  _id?: string;
  Symbol: string;
  StockName: string;
  Range?: number;
  isWatchlist?: boolean;
}

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

const formatVal = (val: any): string => {
  if (val === undefined || val === null) return "-";
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return Number.isInteger(num) ? num.toString() : parseFloat(num.toFixed(3)).toString();
};

export default function Scanner1() {
  // Bulk add-to-watchlist dialog state
  const [bulkWishlistDialogOpen, setBulkWishlistDialogOpen] = useState(false);

  // Bulk add-to-watchlist handler
  const handleBulkWishlistConfirm = async (res: {
    listIds: string[];
    alsoDefault: boolean;
  }) => {
    if (checkedStocks.length === 0) return;
    const ApiUrl = import.meta.env.VITE_API_BASE_URL;
    // Add to selected wishlists
    if (res.listIds.length > 0) {
      for (const stock of checkedStocks) {
        try {
          await fetch(
            `${ApiUrl}/api/wishlist-categories/stocks/add/${stock._id}`,
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
        `Added ${checkedStocks.length} stocks to selected watchlists`,
      );
    }
    // Also add to default watchlist if checked
    if (res.alsoDefault) {
      for (const stock of checkedStocks) {
        try {
          await fetch(`${ApiUrl}/api/stock/watchlist/add/${stock._id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          // Optionally show error
        }
      }
      toast.success(
        `Added ${checkedStocks.length} stocks to default watchlist`,
      );
    }
    setBulkWishlistDialogOpen(false);
    setCheckedStocks([]);
    fetchStockList();
  };

  // All states
  const [allStocks, setAllStocks] = useState<Stock[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [checkedStocks, setCheckedStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectAll, setSelectAll] = useState(false);

  // Watchlist categories states
  const [watchlistCategories, setWatchlistCategories] = useState<
    WatchlistCategory[]
  >([]);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState("all");
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>(
    {},
  );
  const [defaultCount, setDefaultCount] = useState(0);
  const [customWatchlistStocks, setCustomWatchlistStocks] = useState<
    Record<string, Stock[]>
  >({});

  // Pagination states for stock display (20 stocks per group)
  const [stocksPerGroup] = useState(20);
  const [scanner1Results, setScanner1Results] = useState<any[]>([]);
  const [scanner1Loading, setScanner1Loading] = useState(false);
  const [isScanner1PopupOpen, setIsScanner1PopupOpen] = useState(false);
  const [wlDialogOpen, setWlDialogOpen] = useState(false);
  const [wlSymbol, setWlSymbol] = useState("");
  const [wlPendingStockId, setWlPendingStockId] = useState<string | null>(null);

  const [updatingWatchlistIds, setUpdatingWatchlistIds] = useState<Set<string>>(
    new Set(),
  );

  const [scannedSymbols, setScannedSymbols] = useState<string[]>([]);
  const [scannerFilter, setScannerFilter] = useState<"all" | "green" | "red" | "gray">("all");
  const [lastScannedAt, setLastScannedAt] = useState<string | null>(null);

  // Sorting state: Alphabetical (A-Z / Z-A) and Signal Time (Newest / Oldest)
  const [alphaSort, setAlphaSort] = useState<"none" | "asc" | "desc">("none");
  const [signalTimeSort, setSignalTimeSort] = useState<"none" | "newest" | "oldest">("none");

  // Market price states - only for stocks with scanner signals
  const [marketPrices, setMarketPrices] = useState<Record<string, any>>({});
  const [refreshingStocks, setRefreshingStocks] = useState<Set<string>>(new Set());

  // API URL from environment
  const ApiUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8090";

  // Fetch watchlist categories
  const fetchCustomWatchlistStocks = useCallback(
    async (watchlistId: string) => {
      try {
        const response: any = await ApiClient.get(
          `/api/wishlist-categories/stocks/${watchlistId}?page=1&limit=1000`,
        );
        if (response.success && Array.isArray(response.data)) {
          setCustomWatchlistStocks((prev) => ({
            ...prev,
            [watchlistId]: response.data,
          }));
        }
      } catch (error) {
        console.error("Error fetching custom watchlist stocks:", error);
      }
    },
    [],
  );

  const fetchWatchlistCategories = useCallback(async () => {
    try {
      const response: WatchlistCategoryResponse = await ApiClient.get(
        "/api/wishlist-categories",
      );
      if (response.success && Array.isArray(response.data)) {
        const activeCategories = response.data.filter((cat) => !cat.isDeleted);
        setWatchlistCategories(activeCategories);

        // Fetch counts for each category
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
            map[id] = res && typeof res.total === "number" ? res.total : 0;
          });
          setCategoryCounts(map);

          // Pre-fetch stocks for all custom watchlists
          activeCategories.forEach((cat) => {
            fetchCustomWatchlistStocks(cat._id);
          });
        } catch (e) {
          console.warn("Could not fetch category counts");
        }

        // Fetch default watchlist count
        try {
          const defRes: any = await ApiClient.get(
            `/api/stock/watchlist?page=1&limit=1`,
          );
          setDefaultCount(typeof defRes?.total === "number" ? defRes.total : 0);
        } catch (e) {
          // ignore
        }
      }
    } catch (error) {
      console.error("Error fetching watchlist categories:", error);
    }
  }, [fetchCustomWatchlistStocks]);

  const handleTabChange = (value: string) => {
    setSelectedWatchlistId(value);
    if (
      value !== "all" &&
      value !== "default" &&
      !customWatchlistStocks[value]
    ) {
      fetchCustomWatchlistStocks(value);
    }
  };

  const getFilteredStocksCountForColor = (color: "all" | "green" | "red" | "gray") => {
    const safeStocks = Array.isArray(stocks) ? stocks : [];
    let baseStocks: Stock[] = [];
    if (selectedWatchlistId === "all") {
      baseStocks = safeStocks;
    } else if (selectedWatchlistId === "default") {
      baseStocks = safeStocks.filter((stock) => stock.isWatchlist);
    } else {
      const cachedStocks = customWatchlistStocks[selectedWatchlistId];
      if (cachedStocks && Array.isArray(cachedStocks)) {
        baseStocks = cachedStocks;
      } else {
        baseStocks = [];
      }
    }

    // Apply search query so counts match the visual search results
    const searchedStocks = baseStocks.filter(
      (stock) =>
        !searchQuery ||
        stock.Symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stock.StockName.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    if (color === "all") {
      return searchedStocks.length;
    }

    return searchedStocks.filter((stock) => {
      const stockColor = getStockScannerColor(stock.Symbol);
      return stockColor === color;
    }).length;
  };

  const getSignalTimestamp = (sigStr?: string): number => {
    if (!sigStr) return 0;

    // If ISO string e.g. "2026-07-03T10:35:00.000Z"
    if (typeof sigStr === "string" && sigStr.includes("T") && sigStr.endsWith("Z")) {
      const dt = new Date(sigStr);
      return isNaN(dt.getTime()) ? 0 : dt.getTime();
    }

    try {
      // String format from en-IN locale: "3/7/2026, 10:35:00 am" or "25/6/2026, 9:50:00 am" or "10/6/2026, 10:00:00 am"
      const parts = sigStr.split(",");
      const dateStr = parts[0].trim();
      let day = 1, month = 0, year = 1970;

      if (dateStr.includes("/")) {
        const dParts = dateStr.split("/");
        if (dParts.length === 3) {
          day = parseInt(dParts[0], 10);
          month = parseInt(dParts[1], 10) - 1; // Month is 0-indexed in JS Date
          year = parseInt(dParts[2], 10);
        }
      } else if (dateStr.includes("-")) {
        const dParts = dateStr.split("-");
        if (dParts.length === 3) {
          if (dParts[0].length === 4) {
            year = parseInt(dParts[0], 10);
            month = parseInt(dParts[1], 10) - 1;
            day = parseInt(dParts[2], 10);
          } else {
            day = parseInt(dParts[0], 10);
            month = parseInt(dParts[1], 10) - 1;
            year = parseInt(dParts[2], 10);
          }
        }
      }

      let hours = 0, minutes = 0, seconds = 0;
      if (parts[1]) {
        const timeStr = parts[1].trim();
        const timeTokens = timeStr.split(" ");
        const clockTokens = timeTokens[0].split(":");
        hours = parseInt(clockTokens[0], 10) || 0;
        minutes = parseInt(clockTokens[1], 10) || 0;
        seconds = parseInt(clockTokens[2], 10) || 0;

        if (timeTokens[1]) {
          const ampm = timeTokens[1].toLowerCase();
          if (ampm === "pm" && hours < 12) hours += 12;
          if (ampm === "am" && hours === 12) hours = 0;
        }
      }

      const dateObj = new Date(year, month, day, hours, minutes, seconds);
      return isNaN(dateObj.getTime()) ? 0 : dateObj.getTime();
    } catch (e) {
      const dt = new Date(sigStr);
      return isNaN(dt.getTime()) ? 0 : dt.getTime();
    }
  };

  const getStockSignalTimes = (symbol: string) => {
    const result = getStockScannerResult(symbol);
    if (!result) return { maxTime: 0, minTime: 0, t5: 0, t15: 0 };
    const t5 = getSignalTimestamp(result.signal5m?.signalGeneratedAt);
    const t15 = getSignalTimestamp(result.signal15m?.signalGeneratedAt);
    return {
      maxTime: Math.max(t5, t15),
      minTime: Math.min(t5, t15),
      t5,
      t15,
    };
  };

  const getFilteredStocks = () => {
    const safeStocks = Array.isArray(stocks) ? stocks : [];
    let baseStocks: Stock[] = [];
    if (selectedWatchlistId === "all") {
      baseStocks = safeStocks;
    } else if (selectedWatchlistId === "default") {
      baseStocks = safeStocks.filter((stock) => stock.isWatchlist);
    } else {
      const cachedStocks = customWatchlistStocks[selectedWatchlistId];
      if (cachedStocks && Array.isArray(cachedStocks)) {
        baseStocks = cachedStocks;
      } else {
        baseStocks = [];
      }
    }

    let resultList = baseStocks;

    if (scannerFilter !== "all") {
      resultList = resultList.filter((stock) => {
        const color = getStockScannerColor(stock.Symbol);
        return color === scannerFilter;
      });
    }

    // Apply Alphabetical Sorting (A-Z / Z-A)
    if (alphaSort === "asc") {
      resultList = [...resultList].sort((a, b) => (a.Symbol || "").localeCompare(b.Symbol || ""));
    } else if (alphaSort === "desc") {
      resultList = [...resultList].sort((a, b) => (b.Symbol || "").localeCompare(a.Symbol || ""));
    }

    // Apply Signal Time Sorting (Newest generated signal first, checking both 5m and 15m with tie-breaker)
    if (signalTimeSort === "newest") {
      resultList = [...resultList].sort((a, b) => {
        const sigA = getStockSignalTimes(a.Symbol);
        const sigB = getStockSignalTimes(b.Symbol);

        if (sigA.maxTime === 0 && sigB.maxTime === 0) return 0;
        if (sigA.maxTime === 0) return 1; // Put stocks without signal at the end
        if (sigB.maxTime === 0) return -1;

        // 1. Primary sort: compare latest signal time (Max of 5m and 15m)
        if (sigB.maxTime !== sigA.maxTime) {
          return sigB.maxTime - sigA.maxTime;
        }

        // 2. Secondary tie-breaker: if 15m (or max) time is identical, compare 5m (or min) signal time!
        if (sigB.minTime !== sigA.minTime) {
          return sigB.minTime - sigA.minTime;
        }

        // 3. Fallback: Alphabetical
        return (a.Symbol || "").localeCompare(b.Symbol || "");
      });
    } else if (signalTimeSort === "oldest") {
      resultList = [...resultList].sort((a, b) => {
        const sigA = getStockSignalTimes(a.Symbol);
        const sigB = getStockSignalTimes(b.Symbol);

        if (sigA.maxTime === 0 && sigB.maxTime === 0) return 0;
        if (sigA.maxTime === 0) return 1;
        if (sigB.maxTime === 0) return -1;

        if (sigA.maxTime !== sigB.maxTime) {
          return sigA.maxTime - sigB.maxTime;
        }

        if (sigA.minTime !== sigB.minTime) {
          return sigA.minTime - sigB.minTime;
        }

        return (a.Symbol || "").localeCompare(b.Symbol || "");
      });
    }

    return resultList;
  };

  const getGroupedStocks = () => {
    const filteredStocks = getFilteredStocks().filter(
      (stock) =>
        !searchQuery ||
        stock.Symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stock.StockName.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const groups = [];
    for (let i = 0; i < filteredStocks.length; i += stocksPerGroup) {
      groups.push(filteredStocks.slice(i, i + stocksPerGroup));
    }
    return groups;
  };

  const getTotalFilteredStocks = () => {
    return getFilteredStocks().filter(
      (stock) =>
        !searchQuery ||
        stock.Symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stock.StockName.toLowerCase().includes(searchQuery.toLowerCase()),
    ).length;
  };

  const fetchSavedScannerResults = async () => {
    try {
      const data: any = await ApiClient.get("/api/scanner1/results");
      if (data && data.success) {
        setScanner1Results(data.data || []);
        if (data.lastScannedAt) {
          setLastScannedAt(data.lastScannedAt);
        }
        if (Array.isArray(data.data)) {
          const symbols = data.data.map((r: any) => r.symbol);
          setScannedSymbols(symbols);
          // Fetch market prices only for signal stocks
          fetchMarketPricesForSignalStocks(data.data);
        }
      }
    } catch (error) {
      console.error("Failed to fetch saved scanner results:", error);
    }
  };

  // Fetch current market price for a single stock
  const fetchMarketPrice = async (symbol: string, isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshingStocks((prev) => new Set(prev).add(symbol));
    }
    try {
      const data: any = await ApiClient.get(`/api/marketprice-stock/${symbol}/1d`);
      if (data?.chart?.result?.[0]?.meta?.regularMarketPrice) {
        const marketData = data.chart.result[0].meta;
        setMarketPrices((prev) => ({
          ...prev,
          [symbol]: marketData,
        }));
      }
    } catch (error) {
      console.error(`Error fetching market price for ${symbol}:`, error);
    } finally {
      if (isManualRefresh) {
        setRefreshingStocks((prev) => {
          const newSet = new Set(prev);
          newSet.delete(symbol);
          return newSet;
        });
      }
    }
  };

  const handleStockRefresh = (symbol: string) => {
    fetchMarketPrice(symbol, true);
  };

  const getPriceChange = (symbol: string) => {
    const marketData = marketPrices[symbol];
    if (!marketData || !marketData.regularMarketPrice || !marketData.chartPreviousClose) {
      return 0;
    }
    return marketData.regularMarketPrice - marketData.chartPreviousClose;
  };

  // Reverse mapping: scanner symbol (RELIANCE.NS) -> frontend symbol (RELIANCE)
  const reverseSymbolMapping: Record<string, string> = {
    "^NSEI": "NIFTY",
    "%5ENSEBANK": "BANKNIFTY",
    "NIFTY_FIN_SERVICE.NS": "CNXFINANCE",
    "NIFTY_MID_SELECT.NS": "MIDCPNIFTY1!",
    "M&M.NS": "M_M",
    "M&MFIN.NS": "M_MFIN",
  };

  // Fetch market prices one-by-one only for stocks with scanner signals
  const fetchMarketPricesForSignalStocks = (results: any[]) => {
    if (!results || results.length === 0) return;

    let index = 0;
    const interval = setInterval(() => {
      if (index < results.length) {
        const scannerSymbol = results[index].symbol; // e.g. "RELIANCE.NS"
        // Convert scanner symbol to frontend symbol
        const frontendSymbol = reverseSymbolMapping[scannerSymbol] || scannerSymbol.replace(".NS", "");
        fetchMarketPrice(frontendSymbol);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 1000);
  };

  useEffect(() => {
    fetchStockList();
    fetchWatchlistCategories();
    fetchSavedScannerResults();
  }, [fetchWatchlistCategories]);

  useEffect(() => {
    const safeStocks = Array.isArray(stocks) ? stocks : [];
    const safeCheckedStocks = Array.isArray(checkedStocks) ? checkedStocks : [];

    if (safeCheckedStocks.length === 0) {
      setSelectAll(false);
    } else if (safeCheckedStocks.length === safeStocks.length) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  }, [checkedStocks, stocks]);

  const fetchStockList = async () => {
    setLoading(true);
    try {
      const allStocksData: Stock[] = await ApiClient.get("/api/stock/all");
      if (Array.isArray(allStocksData)) {
        setAllStocks(allStocksData);
        setStocks(allStocksData);
      } else {
        setAllStocks([]);
        setStocks([]);
        toast.error("No stocks data received from server.");
      }
    } catch (err) {
      setAllStocks([]);
      setStocks([]);
      toast.error("Failed to load stocks.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    const safeAllStocks = Array.isArray(allStocks) ? allStocks : [];
    if (value === "") {
      setStocks(safeAllStocks);
    } else {
      const filteredStocks = safeAllStocks.filter(
        (stock) =>
          stock.Symbol.toLowerCase().includes(value.toLowerCase()) ||
          stock.StockName.toLowerCase().includes(value.toLowerCase()),
      );
      setStocks(filteredStocks);
    }
  };

  const handleStockSelection = (stock: Stock) => {
    const isAlreadySelected = checkedStocks.some(
      (s) => s.Symbol === stock.Symbol,
    );
    if (isAlreadySelected) {
      setCheckedStocks(checkedStocks.filter((s) => s.Symbol !== stock.Symbol));
    } else {
      setCheckedStocks([...checkedStocks, stock]);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const filteredStocks = getFilteredStocks().filter(
        (stock) =>
          !searchQuery ||
          stock.Symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          stock.StockName.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      setCheckedStocks(Array.isArray(filteredStocks) ? filteredStocks : []);
    } else {
      setCheckedStocks([]);
    }
  };

  const handleSelectGroup = (groupIndex: number, checked: boolean) => {
    const groupedStocks = getGroupedStocks();
    if (groupIndex < groupedStocks.length) {
      const groupStocks = groupedStocks[groupIndex];
      if (checked) {
        setCheckedStocks((prev) => {
          const existing = prev.filter(
            (stock) => !groupStocks.some((ps) => ps.Symbol === stock.Symbol),
          );
          return [...existing, ...groupStocks];
        });
      } else {
        setCheckedStocks((prev) =>
          prev.filter(
            (stock) => !groupStocks.some((ps) => ps.Symbol === stock.Symbol),
          ),
        );
      }
    }
  };

  const handleRunScanner1 = async () => {
    const allowedSymbolsMapping = {
      NIFTY: "^NSEI",
      BANKNIFTY: "%5ENSEBANK",
      CNXFINANCE: "NIFTY_FIN_SERVICE.NS",
      "MIDCPNIFTY1!": "NIFTY_MID_SELECT.NS",
      M_M: "M&M.NS",
      M_MFIN: "M&MFIN.NS",
    } as const;

    const symbols = checkedStocks
      .map((item) => (allowedSymbolsMapping as any)[item.Symbol] || `${item.Symbol}.NS`)
      .filter(Boolean);

    if (symbols.length === 0) {
      toast.error("Please select at least one stock first.");
      return;
    }
    setScanner1Loading(true);
    setScanner1Results([]);
    setScannedSymbols(symbols);
    try {
      const data = await ApiClient.post("/api/scanner1/run", { symbols });
      if (data && data.success) {
        setScanner1Results(data.data || []);
        if (data.lastScannedAt) {
          setLastScannedAt(data.lastScannedAt);
        }
        if (!data.data || data.data.length === 0) {
          toast.info("No comparable signals found. Both 5m and 15m signals are required per stock.");
        } else {
          toast.success(`Scanner 1 finished! Mapped color status on ${data.data.length} stocks.`);
          // Fetch market prices for signal stocks after scan completes
          fetchMarketPricesForSignalStocks(data.data);
        }
      } else {
        throw new Error(data?.message || "No data received");
      }
    } catch (error: any) {
      toast.error(`Scanner 1 Failed: ${error.message}`);
    } finally {
      setScanner1Loading(false);
    }
  };

  const openWishlistDialog = (symbol: string, stockId?: string) => {
    setWlSymbol(symbol);
    setWlPendingStockId(stockId || null);
    setWlDialogOpen(true);
  };

  const handleWishlistConfirm = async (res: {
    listIds: string[];
    alsoDefault: boolean;
  }) => {
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
    if (res.alsoDefault && wlPendingStockId) {
      try {
        await fetch(`${ApiUrl}/api/stock/watchlist/add/${wlPendingStockId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        toast.success("Added to default watchlist");
      } catch (e) {
        toast.error("Failed to add to default watchlist");
      }
    }
  };

  const getStockScannerColor = (symbol: string) => {
    const allowedSymbolsMapping = {
      NIFTY: "^NSEI",
      BANKNIFTY: "%5ENSEBANK",
      CNXFINANCE: "NIFTY_FIN_SERVICE.NS",
      "MIDCPNIFTY1!": "NIFTY_MID_SELECT.NS",
      M_M: "M&M.NS",
      M_MFIN: "M&MFIN.NS",
    } as const;

    const targetSymbol = (allowedSymbolsMapping as any)[symbol] || `${symbol}.NS`;
    const matched = scanner1Results.find((r: any) => r.symbol === targetSymbol);
    if (matched) return matched.color;
    if (scannedSymbols.includes(targetSymbol)) {
      return "gray";
    }
    return null;
  };

  const getStockScannerResult = (symbol: string) => {
    const allowedSymbolsMapping = {
      NIFTY: "^NSEI",
      BANKNIFTY: "%5ENSEBANK",
      CNXFINANCE: "NIFTY_FIN_SERVICE.NS",
      "MIDCPNIFTY1!": "NIFTY_MID_SELECT.NS",
      M_M: "M&M.NS",
      M_MFIN: "M&MFIN.NS",
    } as const;

    const targetSymbol = (allowedSymbolsMapping as any)[symbol] || `${symbol}.NS`;
    return scanner1Results.find((r: any) => r.symbol === targetSymbol);
  };

  return (
    <>
      <MultiWatchlistDialog
        open={wlDialogOpen}
        onOpenChange={setWlDialogOpen}
        symbol={wlSymbol}
        stockId={wlPendingStockId || ""}
        onConfirm={handleWishlistConfirm}
      />
      <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 lg:p-6">
        {/* RESPONSIVE HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
            🔍 Scanner 1 Dashboard
          </h1>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            {checkedStocks.length > 0 && (
              <>
                <Button
                  variant="secondary"
                  className="gap-2 h-9 sm:h-10 text-xs sm:text-sm w-full sm:w-auto order-1"
                  onClick={() => setBulkWishlistDialogOpen(true)}
                >
                  <Heart className="h-3 w-3 sm:h-4 sm:w-4 text-pink-600" />
                  Add to Watchlist ({checkedStocks.length})
                </Button>
                <MultiWatchlistDialog
                  open={bulkWishlistDialogOpen}
                  onOpenChange={setBulkWishlistDialogOpen}
                  symbol={
                    checkedStocks.length === 1
                      ? checkedStocks[0]?.Symbol || ""
                      : `${checkedStocks.length} selected`
                  }
                  stockId={checkedStocks[0]?._id || ""}
                  onConfirm={handleBulkWishlistConfirm}
                  defaultAlsoAdd={true}
                />
              </>
            )}

            <Button
              onClick={fetchStockList}
              disabled={loading}
              variant="outline"
              className="gap-2 h-9 sm:h-10 text-xs sm:text-sm w-full sm:w-auto order-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "🔄"}
              Stocks
            </Button>
          </div>
        </div>

        {/* SCANNER 1 */}
        <Card>
          <CardHeader className="p-3 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
              🔍 Scanner 1 — 5m vs 15m Signal High Comparison
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={handleRunScanner1}
                  disabled={scanner1Loading || checkedStocks.length === 0}
                  className="h-9 sm:h-10 text-xs sm:text-sm"
                >
                  {scanner1Loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Running...</>
                  ) : (
                    <><Play className="mr-2 h-4 w-4" />Run Scanner 1</>
                  )}
                </Button>
                {checkedStocks.length === 0 && (
                  <p className="text-xs text-muted-foreground self-center">
                    Select stocks from the list below first
                  </p>
                )}
              </div>

              {lastScannedAt && (
                <div className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 p-1.5 px-3 rounded-full border dark:border-slate-700 self-start sm:self-center">
                  🕒 Last Scanned: <span className="font-bold text-slate-700 dark:text-slate-200">{new Date(lastScannedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                </div>
              )}
            </div>

            {!scanner1Loading && scannedSymbols.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground mt-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="font-semibold flex items-center gap-1.5">
                  📈 <span>Scanner Results Applied Inline:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-green-500 hover:bg-green-600 text-white gap-1">
                    🟢 Green : {scanner1Results.filter(r => r.color === 'green').length}
                  </Badge>
                  <Badge className="bg-red-500 hover:bg-red-600 text-white gap-1">
                    🔴 Red : {scanner1Results.filter(r => r.color === 'red').length}
                  </Badge>
                  <Badge className="bg-slate-500 hover:bg-slate-600 text-white gap-1">
                    ⚪ Gray : {scannedSymbols.length - scanner1Results.filter(r => r.color === 'green').length - scanner1Results.filter(r => r.color === 'red').length}
                  </Badge>
                </div>
              </div>
            )}

            {!scanner1Loading && scannedSymbols.length === 0 && checkedStocks.length > 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Click "Run Scanner 1" to compare 5m vs 15m signal highs
              </div>
            )}
          </CardContent>
        </Card>

        {/* RESPONSIVE STOCK SELECTION SECTION WITH WATCHLIST TABS */}
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
                      value="all"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent px-6 py-3 whitespace-nowrap flex-shrink-0"
                    >
                      📊 All Stocks ({allStocks.length})
                    </TabsTrigger>
                    <TabsTrigger
                      value="default"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent px-6 py-3 whitespace-nowrap flex-shrink-0"
                    >
                      <Star className="h-4 w-4 mr-2" />
                      Default ({defaultCount})
                    </TabsTrigger>
                    {watchlistCategories.map((category) => (
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
                <div className="p-3 sm:p-6">
                  <CardTitle className="text-base sm:text-lg mb-4">
                    📋{" "}
                    {selectedWatchlistId === "all"
                      ? "All Stocks"
                      : selectedWatchlistId === "default"
                        ? "Default Watchlist"
                        : watchlistCategories.find(
                          (cat) => cat._id === selectedWatchlistId,
                        )?.name || "Watchlist"}
                    {allStocks.length > 0 &&
                      ` (${getFilteredStocks().length} stocks)`}
                  </CardTitle>
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                      <div className="flex items-center space-x-2 w-full sm:w-auto">
                        <Checkbox
                          id="select-all"
                          checked={selectAll}
                          onCheckedChange={(checked) =>
                            handleSelectAll(checked === true)
                          }
                          className="h-4 w-4"
                        />
                        <Label
                          htmlFor="select-all"
                          className="text-xs sm:text-sm font-medium cursor-pointer"
                        >
                          <b>Select All ({getTotalFilteredStocks()})</b>
                        </Label>
                      </div>
                      <div className="flex-1 relative w-full">
                        <Search className="absolute left-3 top-2.5 sm:top-3 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search stocks..."
                          value={searchQuery}
                          onChange={(e) => handleSearch(e.target.value)}
                          className="pl-8 sm:pl-9 h-8 sm:h-10 text-xs sm:text-sm"
                        />
                      </div>
                    </div>

                    {/* Color Status & Sorting Filters */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      {/* Color Filter */}
                      {scannedSymbols.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-slate-500 mr-1">
                            Filter by Color:
                          </span>
                          <Button
                            size="sm"
                            variant={scannerFilter === "all" ? "default" : "outline"}
                            onClick={() => setScannerFilter("all")}
                            className="h-7 text-xs px-2.5"
                          >
                            All ({getFilteredStocksCountForColor("all")})
                          </Button>
                          <Button
                            size="sm"
                            variant={scannerFilter === "green" ? "default" : "outline"}
                            onClick={() => setScannerFilter("green")}
                            className={`h-7 text-xs px-2.5 ${
                              scannerFilter === "green"
                                ? "bg-green-600 hover:bg-green-700 text-white"
                                : "text-green-600 hover:text-green-700 border-green-200"
                            }`}
                          >
                            🟢 Green ({getFilteredStocksCountForColor("green")})
                          </Button>
                          <Button
                            size="sm"
                            variant={scannerFilter === "red" ? "default" : "outline"}
                            onClick={() => setScannerFilter("red")}
                            className={`h-7 text-xs px-2.5 ${
                              scannerFilter === "red"
                                ? "bg-red-600 hover:bg-red-700 text-white"
                                : "text-red-600 hover:text-red-700 border-red-200"
                            }`}
                          >
                            🔴 Red ({getFilteredStocksCountForColor("red")})
                          </Button>
                          <Button
                            size="sm"
                            variant={scannerFilter === "gray" ? "default" : "outline"}
                            onClick={() => setScannerFilter("gray")}
                            className={`h-7 text-xs px-2.5 ${
                              scannerFilter === "gray"
                                ? "bg-slate-600 hover:bg-slate-700 text-white"
                                : "text-slate-600 hover:text-slate-700 border-slate-200"
                            }`}
                          >
                            ⚪ Gray ({getFilteredStocksCountForColor("gray")})
                          </Button>
                        </div>
                      ) : (
                        <div className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                          ⚡ Stock Filters & Sorting:
                        </div>
                      )}

                      {/* Sorting Controls */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
                          <ArrowUpDown className="h-3 w-3" /> Sort:
                        </span>

                        {/* Alphabetical Sort: A-Z */}
                        <Button
                          size="sm"
                          variant={alphaSort === "asc" ? "default" : "outline"}
                          onClick={() => {
                            setAlphaSort(alphaSort === "asc" ? "none" : "asc");
                            if (alphaSort !== "asc") setSignalTimeSort("none");
                          }}
                          className="h-7 text-xs px-2.5 gap-1"
                          title="Sort Alphabetically A to Z"
                        >
                          <ArrowDownAZ className="h-3.5 w-3.5" />
                          A-Z
                        </Button>

                        {/* Alphabetical Sort: Z-A */}
                        <Button
                          size="sm"
                          variant={alphaSort === "desc" ? "default" : "outline"}
                          onClick={() => {
                            setAlphaSort(alphaSort === "desc" ? "none" : "desc");
                            if (alphaSort !== "desc") setSignalTimeSort("none");
                          }}
                          className="h-7 text-xs px-2.5 gap-1"
                          title="Sort Alphabetically Z to A"
                        >
                          <ArrowUpZA className="h-3.5 w-3.5" />
                          Z-A
                        </Button>

                        {/* Signal Time Sort: Newest First */}
                        <Button
                          size="sm"
                          variant={signalTimeSort === "newest" ? "default" : "outline"}
                          onClick={() => {
                            setSignalTimeSort(signalTimeSort === "newest" ? "none" : "newest");
                            if (signalTimeSort !== "newest") setAlphaSort("none");
                          }}
                          className={`h-7 text-xs px-2.5 gap-1 ${
                            signalTimeSort === "newest"
                              ? "bg-amber-600 hover:bg-amber-700 text-white"
                              : "border-amber-200 text-amber-700 hover:bg-amber-50"
                          }`}
                          title="Sort by latest generated signal (5m & 15m checked - newest first)"
                        >
                          <Clock className="h-3.5 w-3.5" />
                          ⏱️ Signal Time First
                        </Button>

                        {(alphaSort !== "none" || signalTimeSort !== "none") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setAlphaSort("none");
                              setSignalTimeSort("none");
                            }}
                            className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                          >
                            Reset
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Search & Results Info */}
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        {searchQuery ? (
                          <>
                            <Badge variant="outline" className="text-xs">
                              🔍 "{searchQuery}"
                            </Badge>
                            <span>
                              {getTotalFilteredStocks()} filtered stocks in{" "}
                              {getGroupedStocks().length} groups
                            </span>
                          </>
                        ) : (
                          <span>
                            {getTotalFilteredStocks()} total stocks in{" "}
                            {getGroupedStocks().length} groups of 20
                          </span>
                        )}
                      </div>
                      {loading && (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-xs">Loading data...</span>
                        </div>
                      )}
                    </div>

                    {checkedStocks.length > 0 && (
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-xs sm:text-sm font-medium text-blue-700 mb-2">
                          📌 Selected for Scanning ({checkedStocks.length}):
                        </p>
                        <div className="flex flex-wrap gap-1 sm:gap-2">
                          {checkedStocks.slice(0, 10).map((stock) => (
                            <Badge
                              key={stock.Symbol}
                              variant="secondary"
                              className="text-xs px-2 py-1"
                            >
                              {stock.Symbol}
                              <button
                                onClick={() => handleStockSelection(stock)}
                                className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5 text-xs"
                              >
                                ×
                              </button>
                            </Badge>
                          ))}
                          {checkedStocks.length > 10 && (
                            <Badge variant="outline" className="text-xs">
                              +{checkedStocks.length - 10} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin mr-2" />
                      <span className="text-sm sm:text-base mb-2">
                        Fetching stocks from server...
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Loading data...
                      </span>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px] sm:h-[600px] w-full">
                      <div className="space-y-6">
                        {(() => {
                          const groupedStocks = getGroupedStocks();

                          if (groupedStocks.length === 0) {
                            return (
                              <div className="col-span-full text-center py-8 text-muted-foreground">
                                <span className="text-sm sm:text-base">
                                  {searchQuery
                                    ? `No stocks found matching "${searchQuery}"`
                                    : selectedWatchlistId === "all"
                                      ? "No stocks found"
                                      : selectedWatchlistId === "default"
                                        ? "No stocks in default watchlist"
                                        : `No stocks in ${watchlistCategories.find((cat) => cat._id === selectedWatchlistId)?.name || "this watchlist"}`}
                                </span>
                              </div>
                            );
                          }

                          return groupedStocks.map((group, groupIndex) => {
                            const isGroupSelected =
                              group.length > 0 &&
                              group.every((stock) =>
                                checkedStocks.some(
                                  (cs) => cs.Symbol === stock.Symbol,
                                ),
                              );

                            return (
                              <div key={groupIndex} className="space-y-3">
                                {/* Group Header */}
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                                  <Checkbox
                                    id={`group-${groupIndex}`}
                                    checked={isGroupSelected}
                                    onCheckedChange={(checked) =>
                                      handleSelectGroup(
                                        groupIndex,
                                        checked === true,
                                      )
                                    }
                                    className="h-4 w-4"
                                  />
                                  <Label
                                    htmlFor={`group-${groupIndex}`}
                                    className="text-sm font-medium cursor-pointer"
                                  >
                                    <b>
                                      Group {groupIndex + 1} ({group.length}{" "}
                                      stocks)
                                    </b>
                                  </Label>
                                  <Badge variant="outline" className="text-xs">
                                    Stocks {groupIndex * stocksPerGroup + 1} -{" "}
                                    {Math.min(
                                      (groupIndex + 1) * stocksPerGroup,
                                      getTotalFilteredStocks(),
                                    )}
                                  </Badge>
                                </div>

                                {/* Group Stocks Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                                  {group.map((stock) => {
                                    const isSelected = checkedStocks.some(
                                      (s) => s.Symbol === stock.Symbol,
                                    );
                                    const isGroup1 = [
                                      "NIFTY",
                                      "BANKNIFTY",
                                      "CNXFINANCE",
                                      "MIDCPNIFTY1!",
                                    ].includes(stock.Symbol);

                                    // Check if watchlist is being updated
                                    const isUpdatingWatchlist =
                                      updatingWatchlistIds.has(stock._id || "");
                                    const scannerColor = getStockScannerColor(stock.Symbol);
                                    const scannerResult = getStockScannerResult(stock.Symbol);
                                    const currentMarketData = marketPrices[stock.Symbol];
                                    const isRefreshing = refreshingStocks.has(stock.Symbol);

                                    return (
                                      <Card
                                        key={stock._id || stock.Symbol}
                                        className={`p-2 sm:p-3 transition-colors cursor-pointer border-2 ${
                                          scannerColor === "green"
                                            ? "border-green-500 bg-green-50/80 hover:bg-green-100/60 text-green-950"
                                            : scannerColor === "red"
                                              ? "border-red-500 bg-red-50/80 hover:bg-red-100/60 text-red-950"
                                              : scannerColor === "gray"
                                                ? "border-slate-300 bg-slate-100/70 hover:bg-slate-200/50 text-slate-700"
                                                : isSelected
                                                  ? "border-blue-400 bg-blue-50 hover:bg-blue-100/40"
                                                  : isGroup1
                                                    ? "border-primary/20 bg-primary/5 hover:bg-primary/10"
                                                    : "hover:bg-accent/50 border-transparent"
                                        }`}
                                        onClick={() =>
                                          handleStockSelection(stock)
                                        }
                                      >
                                        <div className="flex flex-col gap-2 h-full justify-between">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                              <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() =>
                                                  handleStockSelection(stock)
                                                }
                                                className="h-4 w-4 shrink-0"
                                              />
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1 mb-1">
                                                  <h3 className="font-semibold text-xs sm:text-sm truncate">
                                                    {stock.StockName}
                                                  </h3>
                                                  <Badge
                                                    variant="secondary"
                                                    className="text-xs px-1 py-0.5 shrink-0"
                                                  >
                                                    {stock.Symbol}
                                                  </Badge>
                                                  {isGroup1 && (
                                                    <Badge
                                                      variant="outline"
                                                      className="text-xs px-1 py-0.5 bg-primary/10 shrink-0"
                                                    >
                                                      ⭐
                                                    </Badge>
                                                  )}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap mt-1">
                                                 {stock.Range && (
                                                   <Badge
                                                     variant="outline"
                                                     className="text-xs px-1 py-0.5 shrink-0"
                                                   >
                                                     Range:{stock.Range}
                                                   </Badge>
                                                 )}
                                                 {currentMarketData ? (
                                                   <div className="flex items-center gap-1 min-w-0">
                                                     <span className="font-bold text-xs sm:text-sm text-foreground">
                                                       ₹{currentMarketData.regularMarketPrice.toFixed(2)}
                                                     </span>
                                                     {getPriceChange(stock.Symbol) !== 0 && (
                                                       <div className="flex items-center gap-0.5 shrink-0">
                                                         {getPriceChange(stock.Symbol) > 0 ? (
                                                           <TrendingUp className="h-3 w-3 text-green-600" />
                                                         ) : (
                                                           <TrendingDown className="h-3 w-3 text-red-600" />
                                                         )}
                                                         <span
                                                           className={`text-[10px] sm:text-xs font-medium ${
                                                             getPriceChange(stock.Symbol) > 0
                                                               ? "text-green-600"
                                                               : "text-red-600"
                                                           }`}
                                                         >
                                                           {getPriceChange(stock.Symbol) > 0 ? "+" : ""}
                                                           {getPriceChange(stock.Symbol).toFixed(2)}
                                                         </span>
                                                       </div>
                                                     )}
                                                   </div>
                                                 ) : (
                                                   <span className="text-[10px] text-muted-foreground">
                                                     {isRefreshing ? "Updating..." : "Loading..."}
                                                   </span>
                                                 )}
                                               </div>
                                              </div>

                                              {/* Working Like Button */}
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  openWishlistDialog(
                                                    stock.Symbol,
                                                    stock._id,
                                                  );
                                                }}
                                                disabled={isUpdatingWatchlist}
                                                className="shrink-0 h-6 w-6 sm:h-8 sm:w-8 p-0 relative"
                                                title={
                                                  stock.isWatchlist
                                                    ? "Remove from watchlist"
                                                    : "Add to watchlist"
                                                }
                                              >
                                                {/* Heart Icon with Dynamic State */}
                                                {stock.isWatchlist ? (
                                                  <Heart className="h-3 w-3 sm:h-4 sm:w-4 fill-red-500 text-red-500" />
                                                ) : (
                                                  <HeartOff className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                                                )}

                                                {/* Loading Indicator */}
                                                {isUpdatingWatchlist && (
                                                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded">
                                                    <Loader2 className="h-2 w-2 sm:h-3 sm:w-3 animate-spin text-blue-600" />
                                                  </div>
                                                )}
                                              </Button>

                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const tvUrl = `https://in.tradingview.com/chart/?symbol=NSE%3A${encodeURIComponent((stock.Symbol || "").replace(".NS", ""))}`;
                                                  window.open(
                                                    tvUrl,
                                                    "_blank",
                                                    "noopener,noreferrer",
                                                  );
                                                }}
                                                className="shrink-0 h-6 w-6 sm:h-8 sm:w-8 p-0"
                                                title="Open in TradingView"
                                              >
                                                <img
                                                  src="https://static.tradingview.com/static/images/favicon.ico"
                                                  alt="TV"
                                                  className="h-3 w-3 sm:h-4 sm:w-4"
                                                />
                                              </Button>

                                              {/* Refresh Button - available for all stocks */}
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleStockRefresh(stock.Symbol);
                                                }}
                                                disabled={isRefreshing}
                                                className="shrink-0 h-6 w-6 sm:h-8 sm:w-8 p-0"
                                                title="Refresh current price"
                                              >
                                                {isRefreshing ? (
                                                  <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                  <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4" />
                                                )}
                                              </Button>
                                            </div>
                                          </div>

                                          {/* Scanner Signal Data */}
                                          {scannerResult && (
                                            <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 space-y-2">
                                              {/* 5m Interval Details */}
                                              {scannerResult.signal5m && (
                                                <div className="rounded-md p-2 bg-black/5 dark:bg-white/5 space-y-1.5">
                                                  <div className="flex justify-between items-center font-bold text-foreground">
                                                    <span className="flex items-center gap-1 text-xs sm:text-sm">⏱️ 5m Int</span>
                                                    {scannerResult.signal5m.signalGeneratedAt && (
                                                      <span className="font-medium text-[10px] sm:text-xs text-slate-600 dark:text-slate-400">
                                                        {scannerResult.signal5m.signalGeneratedAt}
                                                      </span>
                                                    )}
                                                  </div>
                                                  
                                                  <div className="grid grid-cols-3 gap-x-1.5 gap-y-1 text-center">
                                                    <div>
                                                      <div className="text-[10px] sm:text-xs font-semibold text-blue-700 dark:text-blue-400">Sig H</div>
                                                      <div className="font-bold text-xs sm:text-sm text-blue-600 dark:text-blue-400 truncate">{formatVal(scannerResult.signal5m.signalHigh)}</div>
                                                    </div>
                                                    <div>
                                                      <div className="text-[10px] sm:text-xs font-semibold text-green-700 dark:text-green-400">Close</div>
                                                      <div className="font-bold text-xs sm:text-sm text-green-600 dark:text-green-400 truncate">
                                                        {formatVal(scannerResult.signal5m.close)}
                                                      </div>
                                                    </div>
                                                    <div>
                                                      <div className="text-[10px] sm:text-xs font-semibold text-amber-700 dark:text-amber-500">Sig L</div>
                                                      <div className="font-bold text-xs sm:text-sm text-amber-600 dark:text-amber-500 truncate">{formatVal(scannerResult.signal5m.signalLow)}</div>
                                                    </div>
                                                  </div>
                                                </div>
                                              )}

                                              {/* 15m Interval Details */}
                                              {scannerResult.signal15m && (
                                                <div className="rounded-md p-2 bg-black/5 dark:bg-white/5 space-y-1.5">
                                                  <div className="flex justify-between items-center font-bold text-foreground">
                                                    <span className="flex items-center gap-1 text-xs sm:text-sm">⏱️ 15m Int</span>
                                                    {scannerResult.signal15m.signalGeneratedAt && (
                                                      <span className="font-medium text-[10px] sm:text-xs text-slate-600 dark:text-slate-400">
                                                        {scannerResult.signal15m.signalGeneratedAt}
                                                      </span>
                                                    )}
                                                  </div>
                                                  
                                                  <div className="grid grid-cols-3 gap-x-1.5 gap-y-1 text-center">
                                                    <div>
                                                      <div className="text-[10px] sm:text-xs font-semibold text-blue-700 dark:text-blue-400">Sig H</div>
                                                      <div className="font-bold text-xs sm:text-sm text-blue-600 dark:text-blue-400 truncate">{formatVal(scannerResult.signal15m.signalHigh)}</div>
                                                    </div>
                                                    <div>
                                                      <div className="text-[10px] sm:text-xs font-semibold text-green-700 dark:text-green-400">Close</div>
                                                      <div className="font-bold text-xs sm:text-sm text-green-600 dark:text-green-400 truncate">
                                                        {formatVal(scannerResult.signal15m.close)}
                                                      </div>
                                                    </div>
                                                    <div>
                                                      <div className="text-[10px] sm:text-xs font-semibold text-amber-700 dark:text-amber-500">Sig L</div>
                                                      <div className="font-bold text-xs sm:text-sm text-amber-600 dark:text-amber-500 truncate">{formatVal(scannerResult.signal15m.signalLow)}</div>
                                                    </div>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </Card>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
