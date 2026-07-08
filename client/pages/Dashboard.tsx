import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ApiClient from "@/lib/apiClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import MultiWatchlistDialog from "@/components/MultiWatchlistDialog";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  TrendingUp,
  TrendingDown,
  Search,
  RotateCcw,
  Loader2,
  Star,
  Heart,
  HeartOff,
} from "lucide-react";

interface Stock {
  _id?: string;
  Symbol: string;
  StockName: string;
  Range?: number;
  isWatchlist?: boolean;
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
export default function Dashboard() {
  // Bulk add-to-watchlist dialog state
  const [bulkWishlistDialogOpen, setBulkWishlistDialogOpen] = useState(false);

  // Add state for custom watchlist stocks
  const [customWatchlistStocks, setCustomWatchlistStocks] = useState<
    Record<string, Stock[]>
  >({});

  // Add state for custom watchlist stocks
  const [watchlistCategories, setWatchlistCategories] = useState<
    WatchlistCategory[]
  >([]);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState("all");
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>(
    {},
  );
  const [defaultCount, setDefaultCount] = useState(0);

  // Bulk add-to-watchlist handler
  const handleBulkWishlistConfirm = async (res: {
    listIds: string[];
    alsoDefault: boolean;
  }) => {
    if (checkedStocks.length === 0) return;
    const ApiUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8090";
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
  const [allStocks, setAllStocks] = useState<Stock[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [timeSeconds, setTimeSeconds] = useState("10");
  const [expiryDate, setExpiryDate] = useState("");
  const [finNiftyExpiry, setFinNiftyExpiry] = useState("");
  const [segment, setSegment] = useState("Equity");
  const [selectAll, setSelectAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [checkedStocks, setCheckedStocks] = useState<Stock[]>([]);
  const [marketPrices, setMarketPrices] = useState<Record<string, MarketPrice>>(
    {},
  );
  const [processedStocks, setProcessedStocks] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [priceIndex, setPriceIndex] = useState(0);
  const [refreshingStocks, setRefreshingStocks] = useState<Set<string>>(
    new Set(),
  );
  const [wlDialogOpen, setWlDialogOpen] = useState(false);
  const [wlSymbol, setWlSymbol] = useState("");
  const [wlPendingStockId, setWlPendingStockId] = useState<string | null>(null);

  // 🔥 Watchlist updating states (same as StockList)
  const [updatingWatchlistIds, setUpdatingWatchlistIds] = useState<Set<string>>(
    new Set(),
  );

  // OLD CODE STATES
  const [onChangeTime, setOnChangeTime] = useState(10);
  const [selectedDate, setSelectedDate] = useState("");
  const [finniftySelectedDate, setFinniftySelectedDate] = useState("");
  const [manageCallPut, setManageCallPut] = useState(false);
  const [CallNearestStrike, setCallNearestStrike] = useState(false);
  const [CallLevelStrike, setCallLevelStrike] = useState(false);
  const [PutNearestStrike, setPutNearestStrike] = useState(false);
  const [PutLevelStrike, setPutLevelStrike] = useState(false);
  const [optionsTimeMange, setOptionsTimeMange] = useState(0);
  const [callLevelValue, setCallLevelValue] = useState(3);
  const [putLevelValue, setPutLevelValue] = useState(3);

  const currentIndexRef = useRef(
    localStorage.getItem("currentIndex")
      ? parseInt(localStorage.getItem("currentIndex"), 10)
      : 0,
  );

  // 🔥 NEW: Simple function to fetch ALL data from single API call
  const fetchStockList = async () => {
    setLoading(true);
    try {
      // console.log("🚀 Fetching ALL stocks from /api/stock/all endpoint...");

      // ✅ Simple single API call to get all data
      const allStocksData: Stock[] = await ApiClient.get("/api/stock/all");

      // console.log("✅ Received data from /api/stock/all:", allStocksData);

      if (Array.isArray(allStocksData)) {
        const priority = ["NIFTY", "BANKNIFTY", "CNXFINANCE", "MIDCPNIFTY1!"];
        const prioritized = [...allStocksData].sort((a, b) => {
          const ai = priority.indexOf(a.Symbol);
          const bi = priority.indexOf(b.Symbol);
          if (ai !== -1 || bi !== -1) {
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
          }
          return a.StockName.localeCompare(b.StockName);
        });
        setAllStocks(prioritized);
        setStocks(prioritized);
        console.log(
          `🎉 Loaded ${prioritized.length} total stocks for dashboard`,
        );
      } else {
        console.warn("⚠️ No data received from /api/stock/all");
        setAllStocks([]);
        setStocks([]);
        toast.error("No stocks data received from server.");
      }
    } catch (err) {
      console.error(
        "❌ Stock fetch error:",
        err instanceof Error ? err.message : "Unknown error",
      );
      setAllStocks([]);
      setStocks([]);
      toast.error(
        "Failed to load stocks. Please check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

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

          // Pre-fetch stocks for all custom watchlists (with limited count for performance)
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
    // Fetch stocks for custom watchlist if not already cached
    if (
      value !== "all" &&
      value !== "default" &&
      !customWatchlistStocks[value]
    ) {
      fetchCustomWatchlistStocks(value);
    }
  };

  // Function to refresh custom watchlist data
  const refreshCustomWatchlistStocks = useCallback(
    (watchlistId: string) => {
      fetchCustomWatchlistStocks(watchlistId);
    },
    [fetchCustomWatchlistStocks],
  );

  const getFilteredStocks = () => {
    // Ensure stocks is always an array
    const safeStocks = Array.isArray(stocks) ? stocks : [];

    if (selectedWatchlistId === "all") {
      return safeStocks; // Show all stocks
    } else if (selectedWatchlistId === "default") {
      return safeStocks.filter((stock) => stock.isWatchlist); // Show default watchlist stocks
    } else {
      // Show stocks from selected custom watchlist
      const cachedStocks = customWatchlistStocks[selectedWatchlistId];
      if (cachedStocks && Array.isArray(cachedStocks)) {
        return cachedStocks;
      }
      return [];
    }
  };
  // 🔥 Dynamic Watchlist Toggle Function (same as StockList - MAINTAIN KARNA HAI)
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

      console.log("✅ Server response:", response);

      if (response && response._id) {
        const serverWatchlistStatus = response.isWatchlist;

        // 🔥 Update both allStocks and stocks arrays
        setAllStocks((prevStocks) =>
          prevStocks.map((stock) => {
            if (stock._id === stockId) {
              return { ...stock, isWatchlist: serverWatchlistStatus };
            }
            return stock;
          }),
        );

        setStocks((prevStocks) =>
          prevStocks.map((stock) => {
            if (stock._id === stockId) {
              return { ...stock, isWatchlist: serverWatchlistStatus };
            }
            return stock;
          }),
        );

        console.log(
          `✅ Watchlist updated to: ${serverWatchlistStatus} for stock ${stockId}`,
        );

        // Show success message
        if (serverWatchlistStatus) {
          toast.success(`✅ ${response.Symbol} added to watchlist!`);
        } else {
          toast.success(`❌ ${response.Symbol} removed from watchlist!`);
        }
      } else {
        throw new Error(response?.message || "Failed to update watchlist");
      }
    } catch (error) {
      console.error("❌ Error updating watchlist:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update watchlist";
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setUpdatingWatchlistIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(stockId);
        return newSet;
      });
    }
  };

  const getLastThursdayOfMonth = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const lastDayOfMonth = new Date(year, month, 0);

    while (lastDayOfMonth.getDay() !== 4) {
      lastDayOfMonth.setDate(lastDayOfMonth.getDate() - 1);
    }

    return lastDayOfMonth;
  };

  useEffect(() => {
    fetchWatchlistCategories();
  }, [fetchWatchlistCategories]);

  useEffect(() => {
    fetchStockList();

    const lastThursday = getLastThursdayOfMonth();
    const formattedDate = new Date(
      lastThursday.getTime() - lastThursday.getTimezoneOffset() * 60000,
    )
      .toISOString()
      .split("T")[0];
    setSelectedDate(formattedDate);
    setExpiryDate(formattedDate);
  }, []);

  const formatDate = () => {
    if (selectedDate) {
      const date = new Date(selectedDate);
      const year = String(date.getFullYear()).slice(-2);
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}${month}${day}`;
    }
    return "";
  };

  const formatDate2 = () => {
    if (finniftySelectedDate) {
      const date = new Date(finniftySelectedDate);
      const year = String(date.getFullYear()).slice(-2);
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}${month}${day}`;
    }
    return "";
  };

  const fetchData = async (Symbol: string, isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshingStocks((prev) => new Set(prev).add(Symbol));
    }

    try {
      const data = await ApiClient.get(`/api/marketprice-stock/${Symbol}/1d`);
      if (data.chart?.result?.[0]?.meta?.regularMarketPrice) {
        const marketPrice = data.chart.result[0].meta;
        setMarketPrices((prevPrices) => ({
          ...prevPrices,
          [Symbol]: marketPrice,
        }));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      if (isManualRefresh) {
        setRefreshingStocks((prev) => {
          const newSet = new Set(prev);
          newSet.delete(Symbol);
          return newSet;
        });
      }
    }
  };

  useEffect(() => {
    if (!stocks || stocks.length === 0) return;

    const interval = setInterval(() => {
      if (priceIndex < stocks.length && stocks[priceIndex]?.Symbol) {
        fetchData(stocks[priceIndex].Symbol);
        setPriceIndex((prevIndex) => prevIndex + 1);
      } else {
        clearInterval(interval);
        setTimeout(() => setPriceIndex(0), 10000);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [priceIndex, stocks]);

  // Main execution logic remains same...
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const executeMainOperation = async () => {
      if (isRunning && checkedStocks.length > 0) {
        const currentUrl = checkedStocks[currentIndexRef.current];

        if (!manageCallPut) {
          // Equity Mode
          const symbolToUseEquity =
            currentUrl?.Symbol === "BAJAJ-AUTO"
              ? "BAJAJ_AUTO"
              : currentUrl?.Symbol;
          const fullUrl = `https://in.tradingview.com/chart/?symbol=NSE%3A${symbolToUseEquity}`;
          const newTab = window.open(fullUrl, "_blank");

          setTimeout(
            () => {
              if (newTab) newTab.close();
              setProcessedStocks((prev) => [...prev, symbolToUseEquity]);

              const nextIndex =
                (currentIndexRef.current + 1) % checkedStocks.length;
              currentIndexRef.current = nextIndex;
              localStorage.setItem("currentIndex", nextIndex.toString());

              if (nextIndex === 0) {
                stopStrategy();
              }
            },
            parseInt(timeSeconds) * 1000,
          );
        } else {
          // Options Mode - complete logic remains same
          if (
            !selectedDate &&
            (!finniftySelectedDate || currentUrl?.Symbol === "CNXFINANCE")
          ) {
            toast.error("Please select the appropriate expiry date first.");
            return;
          }

          try {
            const response = await ApiClient.get(
              `/api/marketprice-stock/${currentUrl?.Symbol}/1d`,
            );
            const data = await response.json();
            const marketPrice = data.chart.result[0].meta?.regularMarketPrice;

            const Checklower =
              Math.floor(marketPrice / (currentUrl.Range || 50)) *
              (currentUrl.Range || 50);
            const Checkhigher =
              Math.ceil(marketPrice / (currentUrl.Range || 50)) *
              (currentUrl.Range || 50);

            const lower = [];
            for (let i = 1; i <= 4; i++) {
              lower.push(Checkhigher - i * (currentUrl.Range || 50));
            }

            const higher = [];
            for (let i = 1; i <= 4; i++) {
              higher.push(Checklower + i * (currentUrl.Range || 50));
            }

            const combinedArray = [...lower.slice(0, 1), ...higher.slice(0, 1)];

            const symbolToUse =
              currentUrl?.Symbol === "CNXFINANCE"
                ? "FINNIFTY"
                : currentUrl?.Symbol === "MIDCPNIFTY1!"
                  ? "MIDCPNIFTY"
                  : currentUrl?.Symbol;

            const formattedDate =
              symbolToUse === "FINNIFTY" ? formatDate2() : formatDate();
            const optionBasicKeywordCall = `${symbolToUse}${formattedDate}C`;
            const optionBasicKeywordPut = `${symbolToUse}${formattedDate}P`;

            const openTabSequentially = async (
              optionKeyword: string,
              closeTime: number,
            ) => {
              return new Promise<void>((resolve) => {
                const url = `https://in.tradingview.com/chart/?symbol=NSE%3A${optionKeyword}`;
                const newTab = window.open(url, "_blank");

                setTimeout(() => {
                  if (newTab) newTab.close();
                  setProcessedStocks((prev) => [...prev, symbolToUse]);
                  resolve();
                }, closeTime * 1000);
              });
            };

            if (combinedArray?.length > 1) {
              if (CallNearestStrike) {
                let selectedNumber = combinedArray[1];
                const optionKeyword = `${optionBasicKeywordCall}${selectedNumber}`;
                await openTabSequentially(optionKeyword, parseInt(timeSeconds));
              }

              if (CallLevelStrike) {
                let selectedNumber =
                  combinedArray[1] + callLevelValue * (currentUrl.Range || 50);
                const optionKeyword = `${optionBasicKeywordCall}${selectedNumber}`;
                await openTabSequentially(optionKeyword, parseInt(timeSeconds));
              }

              if (PutNearestStrike) {
                let selectedNumber = combinedArray[0];
                const optionKeyword = `${optionBasicKeywordPut}${selectedNumber}`;
                await openTabSequentially(optionKeyword, parseInt(timeSeconds));
              }

              if (PutLevelStrike) {
                let selectedNumber =
                  combinedArray[0] - putLevelValue * (currentUrl.Range || 50);
                const optionKeyword = `${optionBasicKeywordPut}${selectedNumber}`;
                await openTabSequentially(optionKeyword, parseInt(timeSeconds));
              }
            }

            const nextIndex =
              (currentIndexRef.current + 1) % checkedStocks.length;
            currentIndexRef.current = nextIndex;
            localStorage.setItem("currentIndex", nextIndex.toString());

            if (nextIndex === 0) {
              stopStrategy();
            }
          } catch (err) {
            console.error("Error:", err);
          }
        }
      }
    };

    if (isRunning && checkedStocks.length > 0) {
      if (!manageCallPut) {
        executeMainOperation();
        interval = setInterval(
          () => {
            executeMainOperation();
          },
          (parseInt(timeSeconds) + 1) * 1000,
        );
      } else if (
        CallNearestStrike ||
        CallLevelStrike ||
        PutNearestStrike ||
        PutLevelStrike
      ) {
        executeMainOperation();
        interval = setInterval(
          () => {
            executeMainOperation();
          },
          parseInt(timeSeconds) * optionsTimeMange * 1000,
        );
      } else {
        toast.error("Please select any options button.");
      }
    }

    return () => clearInterval(interval);
  }, [isRunning, manageCallPut, timeSeconds, checkedStocks]);

  useEffect(() => {
    let result;

    if (
      CallNearestStrike &&
      CallLevelStrike &&
      PutNearestStrike &&
      PutLevelStrike
    ) {
      result = 4;
    } else if (
      (CallNearestStrike && CallLevelStrike && PutNearestStrike) ||
      (CallNearestStrike && CallLevelStrike && PutLevelStrike) ||
      (CallNearestStrike && PutNearestStrike && PutLevelStrike) ||
      (CallLevelStrike && PutNearestStrike && PutLevelStrike)
    ) {
      result = 3;
    } else if (
      (CallNearestStrike && CallLevelStrike) ||
      (CallNearestStrike && PutNearestStrike) ||
      (CallNearestStrike && PutLevelStrike) ||
      (CallLevelStrike && PutNearestStrike) ||
      (CallLevelStrike && PutLevelStrike) ||
      (PutNearestStrike && PutLevelStrike)
    ) {
      result = 2;
    } else if (
      CallNearestStrike ||
      CallLevelStrike ||
      PutNearestStrike ||
      PutLevelStrike
    ) {
      result = 1;
    } else {
      result = 0;
    }

    setOptionsTimeMange(result);
  }, [CallNearestStrike, CallLevelStrike, PutNearestStrike, PutLevelStrike]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    if (value === "") {
      setStocks(allStocks);
    } else {
      const filteredStocks = allStocks.filter(
        (stock) =>
          stock.Symbol.toLowerCase().includes(value.toLowerCase()) ||
          stock.StockName.toLowerCase().includes(value.toLowerCase()),
      );
      setStocks(filteredStocks);
    }
  };

  const handleStockSelection = (stock: Stock) => {
    if (
      checkedStocks.some((checkedStock) => checkedStock.Symbol === stock.Symbol)
    ) {
      setCheckedStocks(
        checkedStocks.filter(
          (checkedStock) => checkedStock.Symbol !== stock.Symbol,
        ),
      );
    } else {
      setCheckedStocks([...checkedStocks, stock]);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      const filteredStocks = getFilteredStocks().filter(
        (stock) =>
          !searchQuery ||
          stock.Symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          stock.StockName.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      setCheckedStocks(filteredStocks);
    } else {
      setCheckedStocks([]);
    }
  };

  const handleEquityBtn = () => {
    setManageCallPut(false);
    setSegment("Equity");
    setCallNearestStrike(false);
    setCallLevelStrike(false);
    setPutNearestStrike(false);
    setPutLevelStrike(false);
  };

  const handleOptionBtn = () => {
    if (selectedDate) {
      setManageCallPut(true);
      setSegment("Options");
    } else {
      toast.error(
        "Please select current month expiry date to enable options segment.",
      );
    }
  };

  const getPriceChange = (symbol: string) => {
    const marketData = marketPrices[symbol];
    if (!marketData) return 0;
    return marketData.regularMarketPrice - marketData.chartPreviousClose;
  };

  const handleStockRefresh = (symbol: string) => {
    fetchData(symbol, true);
  };

  const startStrategy = () => {
    if (checkedStocks.length === 0) {
      toast.error("Please select at least one stock.");
      return;
    }
    setIsRunning(true);
    setOnChangeTime(parseInt(timeSeconds));
  };

  const stopStrategy = () => {
    setIsRunning(false);
    currentIndexRef.current = 0;
    localStorage.setItem("currentIndex", "0");
  };

  const resetData = () => {
    setTimeSeconds("10");
    setOnChangeTime(10);
    setCheckedStocks([]);
    setManageCallPut(false);
    setCallNearestStrike(false);
    setCallLevelStrike(false);
    setPutNearestStrike(false);
    setPutLevelStrike(false);
    setSelectAll(false);
    setSearchQuery("");
    setProcessedStocks([]);
    setCallLevelValue(3);
    setPutLevelValue(3);
    setIsRunning(false);
    setPriceIndex(0);
    setRefreshingStocks(new Set());
    setSegment("Equity");
    fetchStockList();

    const lastThursday = getLastThursdayOfMonth();
    const formattedDate = new Date(
      lastThursday.getTime() - lastThursday.getTimezoneOffset() * 60000,
    )
      .toISOString()
      .split("T")[0];
    setSelectedDate(formattedDate);
    setExpiryDate(formattedDate);
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
    const ApiUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8090";
    // Add to selected wishlists
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
    // Also add to default watchlist if checked
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
          📊 Strategy Builder
        </h1>

        {/* Right side buttons container */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center">
          {/* Bulk Add to Watchlist Button */}
          {checkedStocks.length > 0 && (
            <div className="order-2 sm:order-1">
              <Button
                variant="secondary"
                className="gap-2 h-9 sm:h-10 text-xs sm:text-sm w-full sm:w-auto"
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
            </div>
          )}

          {/* Reset Button */}
          <div className="order-1 sm:order-2">
            <Button
              onClick={resetData}
              variant="outline"
              className="gap-2 w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm"
            >
              <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4" />
              Reset
            </Button>
          </div>
        </div>
      </div>

      {/* RESPONSIVE STRATEGY CONFIGURATION SECTION */}
      <Card>
        <CardHeader className="p-3 sm:pb-6">
          <CardTitle className="text-base sm:text-lg">
            Strategy Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="time-seconds" className="text-sm">
                Set time in seconds:
              </Label>
              <Input
                id="time-seconds"
                type="number"
                value={timeSeconds}
                onChange={(e) => setTimeSeconds(e.target.value)}
                className="w-full h-9 sm:h-10 text-xs sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiry-date" className="text-sm">
                Select current month expiry date:
              </Label>
              <Input
                id="expiry-date"
                type="date"
                value={expiryDate}
                onChange={(e) => {
                  setExpiryDate(e.target.value);
                  setSelectedDate(e.target.value);
                }}
                className="w-full h-9 sm:h-10 text-xs sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fin-nifty-expiry" className="text-sm">
                Select Fin Nifty{" "}
                <span className="hidden sm:inline">current month</span> expiry:
              </Label>
              <Input
                id="fin-nifty-expiry"
                type="date"
                value={finNiftyExpiry}
                onChange={(e) => {
                  setFinNiftyExpiry(e.target.value);
                  setFinniftySelectedDate(e.target.value);
                }}
                className="w-full h-9 sm:h-10 text-xs sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Segment</Label>
              <div className="flex gap-1 sm:gap-2">
                <Button
                  size="sm"
                  variant={!manageCallPut ? "default" : "outline"}
                  onClick={handleEquityBtn}
                  className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
                >
                  Equity
                </Button>
                <Button
                  size="sm"
                  variant={manageCallPut ? "default" : "outline"}
                  onClick={handleOptionBtn}
                  className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
                >
                  Options
                </Button>
              </div>
            </div>
          </div>

          {/* RESPONSIVE OPTIONS SECTION */}
          {manageCallPut && (
            <div className="mt-4 p-3 sm:p-4 border rounded-lg bg-gray-50">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    <b>Call Options</b>
                  </Label>
                  <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <Button
                      size="sm"
                      variant={CallNearestStrike ? "default" : "outline"}
                      onClick={() => setCallNearestStrike(!CallNearestStrike)}
                      className="w-full sm:w-auto h-8 text-xs"
                    >
                      Nearest Strike
                    </Button>
                    <Input
                      type="number"
                      value={callLevelValue}
                      onChange={(e) =>
                        setCallLevelValue(parseInt(e.target.value))
                      }
                      min="1"
                      max="4"
                      className="w-full sm:w-16 h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      variant={CallLevelStrike ? "default" : "outline"}
                      onClick={() => setCallLevelStrike(!CallLevelStrike)}
                      className="w-full sm:w-auto h-8 text-xs"
                    >
                      Level
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    <b>Put Options</b>
                  </Label>
                  <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <Button
                      size="sm"
                      variant={PutNearestStrike ? "default" : "outline"}
                      onClick={() => setPutNearestStrike(!PutNearestStrike)}
                      className="w-full sm:w-auto h-8 text-xs"
                    >
                      Nearest Strike
                    </Button>
                    <Input
                      type="number"
                      value={putLevelValue}
                      onChange={(e) =>
                        setPutLevelValue(parseInt(e.target.value))
                      }
                      min="1"
                      max="4"
                      className="w-full sm:w-16 h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      variant={PutLevelStrike ? "default" : "outline"}
                      onClick={() => setPutLevelStrike(!PutLevelStrike)}
                      className="w-full sm:w-auto h-8 text-xs"
                    >
                      Level
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3 pt-4 mt-4 border-t">
            <Button
              onClick={startStrategy}
              disabled={isRunning || loading}
              className="w-full sm:min-w-[100px] sm:w-auto h-9 sm:h-10 text-xs sm:text-sm"
            >
              {isRunning && (
                <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
              )}
              {isRunning ? "Running..." : "Start"}
            </Button>
            <Button
              variant="outline"
              onClick={stopStrategy}
              disabled={!isRunning}
              className="w-full sm:min-w-[100px] sm:w-auto h-9 sm:h-10 text-xs sm:text-sm"
            >
              Stop
            </Button>
            <Button
              variant="secondary"
              onClick={resetData}
              className="w-full sm:min-w-[100px] sm:w-auto h-9 sm:h-10 text-xs sm:text-sm"
            >
              Reset
            </Button>
          </div>
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
                        <b>Select all ({getFilteredStocks().length})</b>
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

                  {/* Data source info */}
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      {searchQuery ? (
                        <>
                          <Badge variant="outline" className="text-xs">
                            🔍 "{searchQuery}"
                          </Badge>
                          <span>
                            Showing{" "}
                            {
                              getFilteredStocks().filter(
                                (stock) =>
                                  stock.Symbol.toLowerCase().includes(
                                    searchQuery.toLowerCase(),
                                  ) ||
                                  stock.StockName.toLowerCase().includes(
                                    searchQuery.toLowerCase(),
                                  ),
                              ).length
                            }{" "}
                            of {getFilteredStocks().length} stocks
                          </span>
                        </>
                      ) : (
                        <span>Showing {getFilteredStocks().length} stocks</span>
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
                  <ScrollArea className="h-[400px] sm:h-[500px] lg:h-[600px] w-full">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                      {(() => {
                        const filteredStocks = getFilteredStocks().filter(
                          (stock) =>
                            !searchQuery ||
                            stock.Symbol.toLowerCase().includes(
                              searchQuery.toLowerCase(),
                            ) ||
                            stock.StockName.toLowerCase().includes(
                              searchQuery.toLowerCase(),
                            ),
                        );

                        if (filteredStocks.length === 0) {
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

                        return filteredStocks.map((stock) => {
                          const marketData = marketPrices[stock.Symbol];
                          const priceChange = getPriceChange(stock.Symbol);
                          const isSelected = checkedStocks.some(
                            (s) => s.Symbol === stock.Symbol,
                          );
                          const isProcessed = processedStocks.includes(
                            stock.Symbol,
                          );
                          const isRefreshing = refreshingStocks.has(
                            stock.Symbol,
                          );

                          // Check if watchlist is being updated
                          const isUpdatingWatchlist = updatingWatchlistIds.has(
                            stock._id || "",
                          );

                          return (
                            <Card
                              key={stock._id || stock.Symbol}
                              className={`p-2 sm:p-3 transition-colors cursor-pointer ${
                                isProcessed
                                  ? "bg-green-100 border-green-300"
                                  : isSelected
                                    ? "border-blue-400 bg-blue-50"
                                    : priceChange > 0
                                      ? "bg-green-50"
                                      : priceChange < 0
                                        ? "bg-red-50"
                                        : ""
                              }`}
                              onClick={() => handleStockSelection(stock)}
                            >
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
                                      {[
                                        "NIFTY",
                                        "BANKNIFTY",
                                        "CNXFINANCE",
                                        "MIDCPNIFTY1!",
                                      ].includes(stock.Symbol) && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs px-1 py-0.5 bg-primary/10 shrink-0"
                                        >
                                          ⭐
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 sm:gap-2 text-xs">
                                      {marketData ? (
                                        marketData.error ? (
                                          <div className="flex items-center gap-1">
                                            <span className="text-destructive truncate">
                                              Price Error
                                            </span>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleStockRefresh(
                                                  stock.Symbol,
                                                );
                                              }}
                                              disabled={isRefreshing}
                                              className="h-5 w-5 p-0 shrink-0"
                                            >
                                              {isRefreshing ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                              ) : (
                                                <RotateCcw className="h-3 w-3" />
                                              )}
                                            </Button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1 min-w-0">
                                            <span className="font-bold text-sm sm:text-base truncate">
                                              ₹
                                              {marketData.regularMarketPrice.toFixed(
                                                2,
                                              )}
                                            </span>
                                            {priceChange !== 0 && (
                                              <div className="flex items-center gap-0.5 shrink-0">
                                                {priceChange > 0 ? (
                                                  <TrendingUp className="h-3 w-3 text-green-600" />
                                                ) : (
                                                  <TrendingDown className="h-3 w-3 text-red-600" />
                                                )}
                                                <span
                                                  className={`text-xs font-medium ${
                                                    priceChange > 0
                                                      ? "text-green-600"
                                                      : "text-red-600"
                                                  }`}
                                                >
                                                  {priceChange > 0 ? "+" : ""}
                                                  {priceChange.toFixed(2)}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        )
                                      ) : (
                                        <span className="text-muted-foreground">
                                          Loading...
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-0.5 sm:gap-1 shrink-0">
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
                                      className="h-6 w-6 sm:h-8 sm:w-8 p-0 relative"
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
                                      className="h-6 w-6 sm:h-8 sm:w-8 p-0"
                                      title="Open in TradingView"
                                    >
                                      <img
                                        src="https://static.tradingview.com/static/images/favicon.ico"
                                        alt="TV"
                                        className="h-3 w-3 sm:h-4 sm:w-4"
                                      />
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStockRefresh(stock.Symbol);
                                      }}
                                      disabled={isRefreshing}
                                      className="h-6 w-6 sm:h-8 sm:w-8 p-0"
                                    >
                                      {isRefreshing ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              {/* RESPONSIVE MARKET DATA */}
                              {marketData && !marketData.error && (
                                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                  <span>
                                    Prev:{" "}
                                    <strong>
                                      {marketData.chartPreviousClose.toFixed(2)}
                                    </strong>
                                  </span>
                                  <span className="hidden sm:inline">
                                    Low:{" "}
                                    <strong>
                                      {marketData.regularMarketDayLow.toFixed(
                                        2,
                                      )}
                                    </strong>
                                  </span>
                                  <span className="hidden sm:inline">
                                    High:{" "}
                                    <strong>
                                      {marketData.regularMarketDayHigh.toFixed(
                                        2,
                                      )}
                                    </strong>
                                  </span>
                                  <span className="hidden lg:inline">
                                    52L:{" "}
                                    <strong>
                                      {marketData.fiftyTwoWeekLow.toFixed(2)}
                                    </strong>
                                  </span>
                                  <span className="hidden lg:inline">
                                    52H:{" "}
                                    <strong>
                                      {marketData.fiftyTwoWeekHigh.toFixed(2)}
                                    </strong>
                                  </span>
                                  {stock.Range && (
                                    <span>
                                      Range: <strong>{stock.Range}</strong>
                                    </span>
                                  )}
                                </div>
                              )}
                            </Card>
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
  );
}
