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
import { Star } from "lucide-react";

import {
  Search,
  Clock,
  Activity,
  Loader2,
  Heart,
  HeartOff,
  AlertTriangle,
  Play,
  Square,
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

interface LogResponse {
  success: boolean;
  data?: any;
  error?: string;
}

const formatVal = (val: any): string => {
  if (val === undefined || val === null) return "-";
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return Number.isInteger(num) ? num.toString() : parseFloat(num.toFixed(3)).toString();
};

// RESPONSIVE POPUP COMPONENT (keeping the same)
const StockTable = ({
  logResponse,
  currentTimeLogs,
  isOpen,
  onClose,
  dataBtn,
  ApiUrl,
  candlesInterval,
  operationInterval,
}: {
  logResponse: LogResponse;
  currentTimeLogs: any[];
  isOpen: boolean;
  onClose: () => void;
  dataBtn: string;
  ApiUrl: string;
  candlesInterval: string;
  operationInterval: string[];
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [currentSignals, setCurrentSignals] = useState<{
    [key: string]: any[];
  }>({});

  useEffect(() => {
    if (!logResponse) return;
    let grouped: { [key: string]: any[] } = {};
    const isGrouped = Object.keys(logResponse).every((key) =>
      Array.isArray(logResponse[key]),
    );
    if (isGrouped) {
      grouped = logResponse as unknown as { [key: string]: any[] };
    } else if (logResponse?.data?.length) {
      setSelectedSymbol(logResponse?.data[0]?.symbol);
      grouped = logResponse.data.reduce(
        (acc: { [key: string]: any[] }, item: any) => {
          if (!acc[item.type]) acc[item.type] = [];
          acc[item.type].push(item);
          return acc;
        },
        {},
      );
    }
    setCurrentSignals(grouped);
  }, [logResponse]);

  if (!isOpen) return null;

  const formatDate = (timestamp: string) => {
    if (!timestamp) return "N/A";
    let date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      // Backend sends en-IN locale strings like "16/6/2026, 11:46:08 am"
      // (DD/M/YYYY), which the Date constructor can't parse directly.
      const match = timestamp.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}):(\d{2}):(\d{2})\s*(am|pm)$/i,
      );
      if (match) {
        const [, day, month, year, hour, minute, second, meridiem] = match;
        let h = parseInt(hour, 10) % 12;
        if (meridiem.toLowerCase() === "pm") h += 12;
        date = new Date(
          parseInt(year, 10),
          parseInt(month, 10) - 1,
          parseInt(day, 10),
          h,
          parseInt(minute, 10),
          parseInt(second, 10),
        );
      }
    }
    if (isNaN(date.getTime())) return timestamp;
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getColor = (symbol: string) => {
    const colors = [
      "#e3f2fd",
      "#fce4ec",
      "#e8f5e9",
      "#fff3e0",
      "#ede7f6",
      "#f3e5f5",
      "#e0f7fa",
      "#f1f8e9",
      "#fffde7",
      "#fbe9e7",
      "#edeef7",
      "#e6f3f8",
    ];
    const hash = symbol
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const openTv = (raw: string) => {
    const sym = (raw || "").replace(".NS", "");
    const tvUrl = `https://in.tradingview.com/chart/?symbol=NSE%3A${encodeURIComponent(sym)}`;
    window.open(tvUrl, "_blank", "noopener,noreferrer");
  };

  const SignalColumn = ({ title, data }: { title: string; data: any[] }) => {
    return (
      <div className="flex-1 p-2 sm:p-4">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 h-full">
          <h4 className="text-blue-800 font-semibold mb-2 sm:mb-3 text-sm sm:text-lg">
            {title}
          </h4>
          <div className="h-[1px] bg-indigo-300 mb-3" />
          <div className="max-h-48 sm:max-h-64 overflow-y-auto">
            {data?.length > 0 ? (
              data.map((item, index) => (
                <div
                  key={index}
                  className="mb-2 sm:mb-3 p-2 sm:p-3 rounded-lg border border-gray-300 text-xs sm:text-sm"
                  style={{ backgroundColor: getColor(item.symbol) }}
                >
                  <div className="font-bold flex items-center gap-1 flex-wrap">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2"
                      onClick={() => openTv(item.symbol)}
                    >
                      <img
                        src="https://static.tradingview.com/static/images/favicon.ico"
                        alt="TV"
                        className="h-3 w-3 mr-1"
                      />
                    </Button>
                    <span>
                      {item.symbol} - Date: {formatDate(item.timestamp)}
                    </span>
                  </div>
                  <div className="mt-1">
                    Open: {formatVal(item.open)} | High: {formatVal(item.high)} | Low: {formatVal(item.low)} |
                    Close: {formatVal(item.close)}
                  </div>
                  <div className="mt-1">
                    Signal High: {formatVal(item.signalHigh)} | Signal Low:{" "}
                    {formatVal(item.signalLow)}
                  </div>
                  {item.signalGeneratedAt && (
                    <div className="mt-1 text-blue-600 font-medium">
                      📅 Signal Generated: {item.signalGeneratedAt}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-center py-4 text-sm">
                No data
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg w-full max-w-xs sm:max-w-sm md:max-w-2xl lg:max-w-4xl xl:max-w-6xl max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-3 sm:p-6 border-b">
          <h2 className="text-lg sm:text-2xl font-bold truncate pr-2">
            Signal Results - {
              dataBtn === "currentTimeSignals"
                ? operationInterval.includes("5m") && operationInterval.includes("15m")
                  ? "5min+15min"
                  : "Current Time Signals"
                : dataBtn
            }
          </h2>
          <Button
            variant="outline"
            onClick={onClose}
            size="sm"
            className="shrink-0"
          >
            ✕ <span className="hidden sm:inline">Close</span>
          </Button>
        </div>
        <div className="p-3 sm:p-6">
          {dataBtn === "currentTimeSignals" ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[300px]">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 sm:p-4 text-left font-semibold text-xs sm:text-sm">
                      Buy Signals
                    </th>
                    <th className="border p-2 sm:p-4 text-left font-semibold text-xs sm:text-sm">
                      Sell Signals
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border p-2 sm:p-4 align-top">
                      <div className="space-y-2">
                        {currentTimeLogs?.filter((item) => item.type === "BUY")
                          .length > 0 ? (
                          currentTimeLogs
                            .filter((item) => item.type === "BUY")
                            .map((item, index) => (
                              <div
                                key={index}
                                className="mb-2 sm:mb-3 p-2 sm:p-3 rounded-lg border border-gray-300 text-xs sm:text-sm"
                                style={{
                                  backgroundColor: getColor(item.symbol),
                                }}
                              >
                                <div className="font-bold flex items-center gap-1 flex-wrap">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2"
                                    onClick={() => openTv(item.symbol)}
                                  >
                                    <img
                                      src="https://static.tradingview.com/static/images/favicon.ico"
                                      alt="TV"
                                      className="h-3 w-3 mr-1"
                                    />
                                  </Button>
                                  <span>
                                    {item.symbol} - Date:{" "}
                                    {formatDate(item.timestamp)}
                                  </span>
                                </div>
                                {item.signal5m || item.signal15m ? (
                                  <div className="space-y-1.5 mt-1.5 pt-1.5 border-t border-dashed border-gray-300 text-xs">
                                    {item.signal5m && (
                                      <div className="p-1.5 rounded bg-black/5 dark:bg-white/5 space-y-0.5 text-left">
                                        <div className="font-bold text-blue-850 dark:text-blue-400">⏱️ 5 Min Interval</div>
                                        <div className="grid grid-cols-2 gap-x-2 text-[11px] opacity-90">
                                          <div>Open: <span className="font-semibold">{formatVal(item.signal5m.open)}</span></div>
                                          <div>Close: <span className="font-semibold">{formatVal(item.signal5m.close)}</span></div>
                                          <div>High: <span className="font-semibold">{formatVal(item.signal5m.high)}</span></div>
                                          <div>Low: <span className="font-semibold">{formatVal(item.signal5m.low)}</span></div>
                                          <div className="col-span-2 mt-0.5 border-t border-dashed border-slate-300 flex justify-between">
                                            <span>Sig H: <span className="font-bold text-blue-600 dark:text-blue-400">{formatVal(item.signal5m.signalHigh)}</span></span>
                                            <span>Sig L: <span className="font-bold text-amber-600 dark:text-amber-500">{formatVal(item.signal5m.signalLow)}</span></span>
                                          </div>
                                        </div>
                                        {item.signal5m.signalGeneratedAt && (
                                          <div className="text-[9px] opacity-75">📅 Generated: {item.signal5m.signalGeneratedAt}</div>
                                        )}
                                      </div>
                                    )}
                                    {item.signal15m && (
                                      <div className="p-1.5 rounded bg-black/5 dark:bg-white/5 space-y-0.5 text-left">
                                        <div className="font-bold text-blue-850 dark:text-blue-400">⏱️ 15 Min Interval</div>
                                        <div className="grid grid-cols-2 gap-x-2 text-[11px] opacity-90">
                                          <div>Open: <span className="font-semibold">{formatVal(item.signal15m.open)}</span></div>
                                          <div>Close: <span className="font-semibold">{formatVal(item.signal15m.close)}</span></div>
                                          <div>High: <span className="font-semibold">{formatVal(item.signal15m.high)}</span></div>
                                          <div>Low: <span className="font-semibold">{formatVal(item.signal15m.low)}</span></div>
                                          <div className="col-span-2 mt-0.5 border-t border-dashed border-slate-300 flex justify-between">
                                            <span>Sig H: <span className="font-bold text-blue-600 dark:text-blue-400">{formatVal(item.signal15m.signalHigh)}</span></span>
                                            <span>Sig L: <span className="font-bold text-amber-600 dark:text-amber-500">{formatVal(item.signal15m.signalLow)}</span></span>
                                          </div>
                                        </div>
                                        {item.signal15m.signalGeneratedAt && (
                                          <div className="text-[9px] opacity-75">📅 Generated: {item.signal15m.signalGeneratedAt}</div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <>
                                    <div className="mt-1">
                                      Open: {formatVal(item.open)} | High: {formatVal(item.high)} | Low:{" "}
                                      {formatVal(item.low)} | Close: {formatVal(item.close)}
                                    </div>
                                    <div className="mt-1">
                                      Signal High: {formatVal(item.signalHigh)} | Signal Low:{" "}
                                      {formatVal(item.signalLow)}
                                    </div>
                                    {item.signalGeneratedAt && (
                                      <div className="mt-1 text-blue-600 font-medium">
                                        📅 Signal Generated: {item.signalGeneratedAt}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            ))
                        ) : (
                          <div className="text-gray-500 text-center py-4 text-sm w-full">
                            No data
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="border p-2 sm:p-4 align-top">
                      <div className="space-y-2">
                        {currentTimeLogs?.filter((item) => item.type === "SELL")
                          .length > 0 ? (
                          currentTimeLogs
                            .filter((item) => item.type === "SELL")
                            .map((item, index) => (
                              <div
                                key={index}
                                className="mb-2 sm:mb-3 p-2 sm:p-3 rounded-lg border border-gray-300 text-xs sm:text-sm"
                                style={{
                                  backgroundColor: getColor(item.symbol),
                                }}
                              >
                                <div className="font-bold flex items-center gap-1 flex-wrap">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2"
                                    onClick={() => openTv(item.symbol)}
                                  >
                                    <img
                                      src="https://static.tradingview.com/static/images/favicon.ico"
                                      alt="TV"
                                      className="h-3 w-3 mr-1"
                                    />
                                  </Button>
                                  <span>
                                    {item.symbol} - Date:{" "}
                                    {formatDate(item.timestamp)}
                                  </span>
                                </div>
                                {item.signal5m || item.signal15m ? (
                                  <div className="space-y-1.5 mt-1.5 pt-1.5 border-t border-dashed border-gray-300 text-xs">
                                    {item.signal5m && (
                                      <div className="p-1.5 rounded bg-black/5 dark:bg-white/5 space-y-0.5 text-left">
                                        <div className="font-bold text-blue-850 dark:text-blue-400">⏱️ 5 Min Interval</div>
                                        <div className="grid grid-cols-2 gap-x-2 text-[11px] opacity-90">
                                          <div>Open: <span className="font-semibold">{formatVal(item.signal5m.open)}</span></div>
                                          <div>Close: <span className="font-semibold">{formatVal(item.signal5m.close)}</span></div>
                                          <div>High: <span className="font-semibold">{formatVal(item.signal5m.high)}</span></div>
                                          <div>Low: <span className="font-semibold">{formatVal(item.signal5m.low)}</span></div>
                                          <div className="col-span-2 mt-0.5 border-t border-dashed border-slate-300 flex justify-between">
                                            <span>Sig H: <span className="font-bold text-blue-600 dark:text-blue-400">{formatVal(item.signal5m.signalHigh)}</span></span>
                                            <span>Sig L: <span className="font-bold text-amber-600 dark:text-amber-500">{formatVal(item.signal5m.signalLow)}</span></span>
                                          </div>
                                        </div>
                                        {item.signal5m.signalGeneratedAt && (
                                          <div className="text-[9px] opacity-75">📅 Generated: {item.signal5m.signalGeneratedAt}</div>
                                        )}
                                      </div>
                                    )}
                                    {item.signal15m && (
                                      <div className="p-1.5 rounded bg-black/5 dark:bg-white/5 space-y-0.5 text-left">
                                        <div className="font-bold text-blue-850 dark:text-blue-400">⏱️ 15 Min Interval</div>
                                        <div className="grid grid-cols-2 gap-x-2 text-[11px] opacity-90">
                                          <div>Open: <span className="font-semibold">{formatVal(item.signal15m.open)}</span></div>
                                          <div>Close: <span className="font-semibold">{formatVal(item.signal15m.close)}</span></div>
                                          <div>High: <span className="font-semibold">{formatVal(item.signal15m.high)}</span></div>
                                          <div>Low: <span className="font-semibold">{formatVal(item.signal15m.low)}</span></div>
                                          <div className="col-span-2 mt-0.5 border-t border-dashed border-slate-300 flex justify-between">
                                            <span>Sig H: <span className="font-bold text-blue-600 dark:text-blue-400">{formatVal(item.signal15m.signalHigh)}</span></span>
                                            <span>Sig L: <span className="font-bold text-amber-600 dark:text-amber-500">{formatVal(item.signal15m.signalLow)}</span></span>
                                          </div>
                                        </div>
                                        {item.signal15m.signalGeneratedAt && (
                                          <div className="text-[9px] opacity-75">📅 Generated: {item.signal15m.signalGeneratedAt}</div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <>
                                    <div className="mt-1">
                                      Open: {formatVal(item.open)} | High: {formatVal(item.high)} | Low:{" "}
                                      {formatVal(item.low)} | Close: {formatVal(item.close)}
                                    </div>
                                    <div className="mt-1">
                                      Signal High: {formatVal(item.signalHigh)} | Signal Low:{" "}
                                      {formatVal(item.signalLow)}
                                    </div>
                                    {item.signalGeneratedAt && (
                                      <div className="mt-1 text-blue-600 font-medium">
                                        📅 Signal Generated: {item.signalGeneratedAt}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            ))
                        ) : (
                          <div className="text-gray-500 text-center py-4 text-sm w-full">
                            No data
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <>
              {dataBtn === "5MOperations" && (
                <>
                  <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-center">
                    5 Minute Operations
                  </h3>
                  <div className="space-y-4 sm:space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
                      <SignalColumn
                        title="Directional Bullish @ 5M"
                        data={currentSignals.directionalBullish || []}
                      />
                      <SignalColumn
                        title="Directional Bearish @ 5M"
                        data={currentSignals.directionalBearish || []}
                      />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
                      <SignalColumn
                        title="Piercing Bullish @ 5M"
                        data={currentSignals.piercingBullish || []}
                      />
                      <SignalColumn
                        title="Piercing Bearish @ 5M"
                        data={currentSignals.piercingBearish || []}
                      />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
                      <SignalColumn
                        title="Gap Up @ 5M"
                        data={currentSignals.gapUp || []}
                      />
                      <SignalColumn
                        title="Gap Down @ 5M"
                        data={currentSignals.gapDown || []}
                      />
                    </div>
                  </div>
                </>
              )}
              {dataBtn === "15MOperations" && (
                <>
                  <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-center">
                    15 Minute Operations
                  </h3>
                  <div className="space-y-4 sm:space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
                      <SignalColumn
                        title="Directional Bullish @ 15M"
                        data={currentSignals.directionalBullish || []}
                      />
                      <SignalColumn
                        title="Directional Bearish @ 15M"
                        data={currentSignals.directionalBearish || []}
                      />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
                      <SignalColumn
                        title="Piercing Bullish @ 15M"
                        data={currentSignals.piercingBullish || []}
                      />
                      <SignalColumn
                        title="Piercing Bearish @ 15M"
                        data={currentSignals.piercingBearish || []}
                      />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
                      <SignalColumn
                        title="Gap Up @ 15M"
                        data={currentSignals.gapUp || []}
                      />
                      <SignalColumn
                        title="Gap Down @ 15M"
                        data={currentSignals.gapDown || []}
                      />
                    </div>
                  </div>
                </>
              )}
              {dataBtn === "BothOperations" && (
                <>
                  <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-center">
                    5 Min + 15 Min Confirmed Signals
                  </h3>
                  <p className="text-xs sm:text-sm text-center text-muted-foreground mb-4">
                    Only stocks confirmed on <strong>both</strong> 5-min and 15-min timeframes are shown
                  </p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
                    <div className="flex-1 p-2 sm:p-4">
                      <div className="bg-white rounded-lg border border-green-300 shadow-sm p-4 h-full">
                        <h4 className="text-green-700 font-semibold mb-2 sm:mb-3 text-sm sm:text-lg">
                          Bullish (5M + 15M Confirmed)
                        </h4>
                        <div className="h-[1px] bg-green-300 mb-3" />
                        <div className="max-h-48 sm:max-h-64 overflow-y-auto">
                          {(currentSignals.combined5m15mBullish || []).length > 0 ? (
                            (currentSignals.combined5m15mBullish || []).map((item: any, index: number) => (
                              <div
                                key={index}
                                className="mb-2 sm:mb-3 p-2 sm:p-3 rounded-lg border border-green-200 text-xs sm:text-sm"
                                style={{ backgroundColor: getColor(item.symbol) }}
                              >
                                <div className="font-bold flex items-center gap-1 flex-wrap">
                                  <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => openTv(item.symbol)}>
                                    <img src="https://static.tradingview.com/static/images/favicon.ico" alt="TV" className="h-3 w-3 mr-1" />
                                  </Button>
                                  <span>{item.symbol} — {formatDate(item.timestamp)}</span>
                                </div>
                                <div className="mt-1 font-medium text-green-700">5M: O:{item.open} H:{item.high} L:{item.low} C:{item.close}</div>
                                <div className="mt-0.5 text-gray-600">5M SigH: {item.signalHigh} | SigL: {item.signalLow}</div>
                                <div className="mt-1 font-medium text-blue-700">15M: O:{item.open15m} H:{item.high15m} L:{item.low15m} C:{item.close15m}</div>
                                <div className="mt-0.5 text-gray-600">15M SigH: {item.signalHigh15m} | SigL: {item.signalLow15m}</div>
                              </div>
                            ))
                          ) : (
                            <div className="text-gray-500 text-center py-4 text-sm">No data</div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 p-2 sm:p-4">
                      <div className="bg-white rounded-lg border border-red-300 shadow-sm p-4 h-full">
                        <h4 className="text-red-700 font-semibold mb-2 sm:mb-3 text-sm sm:text-lg">
                          Bearish (5M + 15M Confirmed)
                        </h4>
                        <div className="h-[1px] bg-red-300 mb-3" />
                        <div className="max-h-48 sm:max-h-64 overflow-y-auto">
                          {(currentSignals.combined5m15mBearish || []).length > 0 ? (
                            (currentSignals.combined5m15mBearish || []).map((item: any, index: number) => (
                              <div
                                key={index}
                                className="mb-2 sm:mb-3 p-2 sm:p-3 rounded-lg border border-red-200 text-xs sm:text-sm"
                                style={{ backgroundColor: getColor(item.symbol) }}
                              >
                                <div className="font-bold flex items-center gap-1 flex-wrap">
                                  <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => openTv(item.symbol)}>
                                    <img src="https://static.tradingview.com/static/images/favicon.ico" alt="TV" className="h-3 w-3 mr-1" />
                                  </Button>
                                  <span>{item.symbol} — {formatDate(item.timestamp)}</span>
                                </div>
                                <div className="mt-1 font-medium text-green-700">5M: O:{item.open} H:{item.high} L:{item.low} C:{item.close}</div>
                                <div className="mt-0.5 text-gray-600">5M SigH: {item.signalHigh} | SigL: {item.signalLow}</div>
                                <div className="mt-1 font-medium text-blue-700">15M: O:{item.open15m} H:{item.high15m} L:{item.low15m} C:{item.close15m}</div>
                                <div className="mt-0.5 text-gray-600">15M SigH: {item.signalHigh15m} | SigL: {item.signalLow15m}</div>
                              </div>
                            ))
                          ) : (
                            <div className="text-gray-500 text-center py-4 text-sm">No data</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

import MultiWatchlistDialog from "@/components/MultiWatchlistDialog";

export default function Scanner() {
  // Bulk add-to-watchlist dialog state
  const [bulkWishlistDialogOpen, setBulkWishlistDialogOpen] = useState(false);

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
  // All states
  const [allStocks, setAllStocks] = useState<Stock[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [checkedStocks, setCheckedStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
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
  // Add state for custom watchlist stocks
  const [customWatchlistStocks, setCustomWatchlistStocks] = useState<
    Record<string, Stock[]>
  >({});

  // Pagination states for stock display (20 stocks per group)
  const [stocksPerGroup] = useState(20);
  const [candlesInterval, setCandlesInterval] = useState("15m");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSignal, setSelectedSignal] = useState("");
  const [isCurrentTimeSelected, setIsCurrentTimeSelected] = useState(false);
  const [operationInterval, setOperationInterval] = useState<string[]>([]);
  const [logResponse, setLogResponse] = useState<LogResponse>({
    success: false,
  });
  const [currentTimeLogs, setCurrentTimeLogs] = useState<any[]>([]);
  const [selectedPopupType, setSelectedPopupType] = useState("");
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [marketPrices, setMarketPrices] = useState<{ [key: string]: any }>({});
  const [scanner1Results, setScanner1Results] = useState<any[]>([]);
  const [scanner1Loading, setScanner1Loading] = useState(false);
  const [isScanner1PopupOpen, setIsScanner1PopupOpen] = useState(false);
  const [wlDialogOpen, setWlDialogOpen] = useState(false);
  const [wlSymbol, setWlSymbol] = useState("");
  const [wlPendingStockId, setWlPendingStockId] = useState<string | null>(null);

  // 🔥 Watchlist updating states (same as StockList - MAINTAIN KARNA HAI)
  const [updatingWatchlistIds, setUpdatingWatchlistIds] = useState<Set<string>>(
    new Set(),
  );

  // API URL from environment
  const ApiUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8090";
  const [controller, setController] = useState<AbortController | null>(null);

  const signalOptions = ["5 Min Operations", "15 Min Operations", "5 Min & 15 Min Operations"];
  const popupTypeMap = {
    "Get Current Time Signals": "currentTimeSignals",
    "5 Min Operations": "5MOperations",
    "15 Min Operations": "15MOperations",
    "5 Min & 15 Min Operations": "BothOperations",
  };
  const signalEndpointMap = {
    "5 Min Operations": "/api/signals/directional-bearish/5m",
    "15 Min Operations": "/api/signals/directional-bearish/15m",
    "5 Min & 15 Min Operations": "/api/signals/directional-bearish/5m15m",
    "Get Current Time Signals": "/api/live-logs/run-live-testing",
  };
  const intervalOptions = ["5m", "15m", "30m", "1h", "1d"];

  // 🔥 BACKEND: Fetch watchlist categories
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

  // Function to group stocks in sets of 20
  const getGroupedStocks = () => {
    const filteredStocks = getFilteredStocks().filter(
      (stock) =>
        !searchQuery ||
        stock.Symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stock.StockName.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    // Group stocks in sets of 20
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

  useEffect(() => {
    const formattedDate = new Date().toISOString().split("T")[0];
    setSelectedDate(formattedDate);
    fetchStockList();
    fetchWatchlistCategories();
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

  // 🔥 NEW: Simple function to fetch ALL data from single API call
  const fetchStockList = async () => {
    setLoading(true);
    try {
      // console.log("🚀 Fetching ALL stocks from /api/stock/all endpoint...");

      // ✅ Simple single API call to get all data
      const allStocksData: Stock[] = await ApiClient.get("/api/stock/all");

      // console.log("✅ Received data from /api/stock/all:", allStocksData);

      if (Array.isArray(allStocksData)) {
        setAllStocks(allStocksData);
        setStocks(allStocksData);
        console.log(
          `🎉 Loaded ${allStocksData.length} total stocks for scanner`,
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

        // Update both allStocks and stocks arrays
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
        // Add group stocks to existing selection
        setCheckedStocks((prev) => {
          const existing = prev.filter(
            (stock) => !groupStocks.some((ps) => ps.Symbol === stock.Symbol),
          );
          return [...existing, ...groupStocks];
        });
      } else {
        // Remove group stocks from selection
        setCheckedStocks((prev) =>
          prev.filter(
            (stock) => !groupStocks.some((ps) => ps.Symbol === stock.Symbol),
          ),
        );
      }
    }
  };

  const handleOperationCheckboxChange = (value: string) => {
    setOperationInterval((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
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
    try {
      const data = await ApiClient.post("/api/scanner1/run", { symbols });
      if (data && data.success) {
        setScanner1Results(data.data || []);
        if (!data.data || data.data.length === 0) {
          toast.info("No comparable signals found. Both 5m and 15m signals are required per stock.");
        } else {
          setIsScanner1PopupOpen(true);
        }
      } else {
        throw new Error(data?.message || "No data received");
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        toast.error(`Scanner 1 Failed: ${error.message}`);
      }
    } finally {
      setScanner1Loading(false);
    }
  };

  const fetchData = async (Symbol: string) => {
    try {
      const res = await fetch(
        `${ApiUrl}/api/marketprice-stock/${Symbol}/${candlesInterval}`,
      );

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;

      if (price) {
        setMarketPrices((prev) => ({
          ...prev,
          [Symbol]: data.chart.result[0].meta,
        }));
      }
    } catch (error) {
      console.error("Error fetching price for", Symbol, ":", error);
    }
  };

  const handleSignalFetch = async () => {
    if (!isCurrentTimeSelected) {
      toast.error(
        "Please click the 'Get Current Time Signals' button first or use the Start button on the Signals card.",
      );
      return;
    }
    // console.log("handleSignalFetchhandleSignalFetchhandleSignalFetchhandleSignalFetchhandleSignalFetch");

    if (controller) {
      controller.abort();
    }

    const newController = new AbortController();
    setController(newController);

    const allowedSymbolsMapping = {
      NIFTY: "^NSEI",
      BANKNIFTY: "%5ENSEBANK",
      CNXFINANCE: "NIFTY_FIN_SERVICE.NS",
      "MIDCPNIFTY1!": "NIFTY_MID_SELECT.NS",
      M_M: "M&M.NS",
      M_MFIN: "M&MFIN.NS",
    };

    const symbols = checkedStocks.map(
      (item) => allowedSymbolsMapping[item.Symbol] || `${item.Symbol}.NS`,
    );

    const endpoint = signalEndpointMap["Get Current Time Signals"];
    console.log("endpoint", endpoint);

    setScanning(true);

    try {
      const data = await ApiClient.post(endpoint, {
        symbols,
        interval: candlesInterval,
        operationInterval: operationInterval,
        selectedDate: selectedDate,
      });

      if (data && data.success) {
        setSelectedPopupType("currentTimeSignals");
        setCurrentTimeLogs(data.data || []);
        setIsPopupOpen(true);
        if (!data.data || data.data.length === 0) {
          toast.info(
            "No BUY/SELL signals found for the selected stocks, interval and date.",
          );
        }
      } else {
        throw new Error(data?.message || "No data received from server");
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("Signal API error:", error.message);
        toast.error(`Signal Fetch Failed: ${error.message}`);
      }
    } finally {
      setScanning(false);
      setController(null);
    }
  };

  const handleStartSignals = async () => {
    if (!signalOptions.includes(selectedSignal)) {
      toast.error("Please select an operation first.");
      return;
    }
    if (checkedStocks.length === 0) {
      toast.error("⚠️ Please select at least one symbol.");
      return;
    }
    if (!selectedDate) {
      toast.error("⚠️ Please select date.");
      return;
    }
    console.log("handleStartSignalshandleStartSignalshandleStartSignalshandleStartSignalshandleStartSignals");

    if (controller) {
      controller.abort();
    }

    const newController = new AbortController();
    setController(newController);

    const allowedSymbolsMapping = {
      NIFTY: "^NSEI",
      BANKNIFTY: "%5ENSEBANK",
      CNXFINANCE: "NIFTY_FIN_SERVICE.NS",
      "MIDCPNIFTY1!": "NIFTY_MID_SELECT.NS",
      M_M: "M&M.NS",
      M_MFIN: "M&MFIN.NS",
    } as const;

    const symbols = checkedStocks.map(
      (item) =>
        (allowedSymbolsMapping as any)[item.Symbol] || `${item.Symbol}.NS`,
    );

    setScanning(true);
    try {
      let data: any = { success: false };

      const endpoint = signalEndpointMap[selectedSignal as keyof typeof signalEndpointMap];
      const payload: any = { symbols, selectedDate };
      if (selectedSignal !== "5 Min & 15 Min Operations") {
        payload.interval = candlesInterval;
      }
      data = await ApiClient.post(endpoint, payload);

      if (data && data.success) {
        const popupType =
          popupTypeMap[selectedSignal as keyof typeof popupTypeMap] ||
          "unknown";
        setSelectedPopupType(popupType);
        setLogResponse(data);
        setIsPopupOpen(true);
        if (!data.data || data.data.length === 0) {
          toast.info(
            "No signals found for the selected stocks, interval and date.",
          );
        }
      } else {
        throw new Error(data?.message || "No data received from server");
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("Signal API error:", error.message);
        toast.error(`Signal Fetch Failed: ${error.message}`);
      }
    } finally {
      setScanning(false);
      setController(null);
    }
  };

  const stopScanning = () => {
    if (controller) {
      controller.abort();
      setController(null);
    }
    setScanning(false);
  };

  const groupSize = 20;
  const groupedStocks = [];
  for (let i = 0; i < stocks.length; i += groupSize) {
    groupedStocks.push(stocks.slice(i, i + groupSize));
  }

  const handleGroupSelectAll = (group: Stock[], isChecked: boolean) => {
    if (isChecked) {
      const stocksToAdd = group.filter(
        (stock) =>
          !checkedStocks.some((selected) => selected.Symbol === stock.Symbol),
      );
      setCheckedStocks([...checkedStocks, ...stocksToAdd]);
    } else {
      const remainingStocks = checkedStocks.filter(
        (stock) =>
          !group.some((groupStock) => groupStock.Symbol === stock.Symbol),
      );
      setCheckedStocks(remainingStocks);
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
    <>
      {scanning && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-md shadow p-4 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <div className="text-sm font-medium">Processing... Please wait</div>
          </div>
        </div>
      )}
      <MultiWatchlistDialog
        open={wlDialogOpen}
        onOpenChange={setWlDialogOpen}
        symbol={wlSymbol}
        stockId={wlPendingStockId || ""}
        onConfirm={handleWishlistConfirm}
      />
      <StockTable
        logResponse={logResponse}
        currentTimeLogs={currentTimeLogs}
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        dataBtn={selectedPopupType}
        ApiUrl={ApiUrl}
        candlesInterval={candlesInterval}
        operationInterval={operationInterval}
      />
      <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 lg:p-6">
        {/* RESPONSIVE HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
            📊 Strategy Builder & Scanner
          </h1>

          {/* Right side buttons container */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            {/* Conditional Add to Watchlist Button */}
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

            {/* Refresh Button - Always visible */}
            <Button
              onClick={fetchStockList}
              disabled={loading}
              variant="outline"
              className="gap-2 h-9 sm:h-10 text-xs sm:text-sm w-full sm:w-auto order-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "🔄"}
              <span className="hidden sm:inline">Refresh</span>
              <span className="sm:hidden">Refresh</span> Stocks
            </Button>
          </div>
        </div>

        {/* RESPONSIVE STRATEGY BUILDER SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Strategy Builder Card */}
          <Card>
            <CardHeader className="p-3 sm:pb-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
                Strategy Builder
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  <b>Set Signal Time Interval:</b>
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2">
                  {intervalOptions.map((interval) => (
                    <div
                      key={interval}
                      className="flex items-center space-x-2 text-xs sm:text-sm"
                    >
                      <Checkbox
                        id={`interval-${interval}`}
                        checked={operationInterval.includes(interval)}
                        onCheckedChange={() =>
                          handleOperationCheckboxChange(interval)
                        }
                        className="h-4 w-4"
                      />
                      <Label
                        htmlFor={`interval-${interval}`}
                        className="text-xs sm:text-sm cursor-pointer"
                      >
                        {interval}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Button
                  variant={isCurrentTimeSelected ? "default" : "outline"}
                  onClick={() => setIsCurrentTimeSelected(true)}
                  className="w-full h-9 sm:h-10 text-xs sm:text-sm"
                >
                  Get Current Time Signals
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  onClick={handleSignalFetch}
                  disabled={scanning || loading}
                  className="flex-1 h-9 sm:h-10 text-xs sm:text-sm"
                >
                  <Play className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  {scanning ? "Running..." : "Start"}
                </Button>
                <Button
                  variant="outline"
                  onClick={stopScanning}
                  disabled={!scanning}
                  className="flex-1 h-9 sm:h-10 text-xs sm:text-sm"
                >
                  <Square className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  Stop
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Signals Card */}
          <Card>
            <CardHeader className="p-3 sm:pb-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
                Signals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div className="grid gap-2">
                {signalOptions.map((label) => (
                  <Button
                    key={label}
                    variant={selectedSignal === label ? "default" : "outline"}
                    onClick={() => setSelectedSignal(selectedSignal === label ? "" : label)}
                    className="w-full h-9 sm:h-10 text-xs sm:text-sm"
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  <b>Select Date:</b>
                </Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="h-9 sm:h-10 text-xs sm:text-sm"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  onClick={handleStartSignals}
                  disabled={scanning || loading}
                  className="flex-1 h-9 sm:h-10 text-xs sm:text-sm"
                >
                  <Play className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  {scanning ? "Running..." : "Start"}
                </Button>
                <Button
                  variant="outline"
                  onClick={stopScanning}
                  disabled={!scanning}
                  className="flex-1 h-9 sm:h-10 text-xs sm:text-sm"
                >
                  <Square className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  Stop
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SCANNER 1 */}
        {/* <Card>
          <CardHeader className="p-3 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
              🔍 Scanner 1 — 5m vs 15m Signal High Comparison
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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

            {scanner1Results.length > 0 && (
              <div className="space-y-2 mt-4">
                <p className="text-sm text-muted-foreground font-medium">
                  Results ready. Click below to view:
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => setIsScanner1PopupOpen(true)}
                  className="w-full sm:w-auto"
                >
                  View {scanner1Results.length} Result(s)
                </Button>
              </div>
            )}

            {isScanner1PopupOpen && scanner1Results.length > 0 && (
              <div
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4"
                onClick={() => setIsScanner1PopupOpen(false)}
              >
                <div
                  className="bg-white rounded-lg w-full max-w-xs sm:max-w-sm md:max-w-2xl lg:max-w-4xl xl:max-w-6xl max-h-[90vh] overflow-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center p-3 sm:p-6 border-b">
                    <h2 className="text-lg sm:text-2xl font-bold truncate pr-2">
                      Scanner 1 Results
                    </h2>
                    <Button
                      variant="outline"
                      onClick={() => setIsScanner1PopupOpen(false)}
                      size="sm"
                      className="shrink-0"
                    >
                      ✕ <span className="hidden sm:inline">Close</span>
                    </Button>
                  </div>
                  <div className="p-3 sm:p-6">
                    <p className="text-xs text-muted-foreground font-medium mb-4">
                      {scanner1Results.length} result(s)
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {scanner1Results.map((item: any) => (
                        <div
                          key={item.symbol}
                          className={`rounded-lg border-2 p-3 text-sm flex items-center justify-center ${
                            item.color === "green"
                              ? "border-green-500 bg-green-50 text-green-700"
                              : item.color === "red"
                                ? "border-red-500 bg-red-50 text-red-700"
                                : "border-slate-300 bg-slate-100 text-slate-600"
                          }`}
                        >
                          <span className="font-bold text-base">{item.symbol}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!scanner1Loading && scanner1Results.length === 0 && checkedStocks.length > 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Click "Run Scanner 1" to compare 5m vs 15m signal highs
              </div>
            )}
          </CardContent>
        </Card> */}

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

                                    return (
                                      <Card
                                        key={stock._id || stock.Symbol}
                                        className={`p-2 sm:p-3 hover:bg-accent/50 transition-colors cursor-pointer ${isSelected
                                          ? "border-blue-400 bg-blue-50"
                                          : isGroup1
                                            ? "border-primary/20 bg-primary/5"
                                            : ""
                                          }`}
                                        onClick={() =>
                                          handleStockSelection(stock)
                                        }
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
                                                {isGroup1 && (
                                                  <Badge
                                                    variant="outline"
                                                    className="text-xs px-1 py-0.5 bg-primary/10 shrink-0"
                                                  >
                                                    ⭐
                                                  </Badge>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                {stock.Range && (
                                                  <Badge
                                                    variant="outline"
                                                    className="text-xs px-1 py-0.5 shrink-0"
                                                  >
                                                    Range:{stock.Range}
                                                  </Badge>
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
                                          </div>
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

        {/* BULK ADD TO WATCHLIST BUTTON - Top Left, like Dashboard/StockList */}

        <Card>
          <CardHeader className="p-3 sm:pb-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
              📡 Live Signals Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="5m" className="w-full">
              <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 h-8 sm:h-10">
                <TabsTrigger value="5m" className="text-xs sm:text-sm">
                  5M
                </TabsTrigger>
                <TabsTrigger value="15m" className="text-xs sm:text-sm">
                  15M
                </TabsTrigger>
                <TabsTrigger
                  value="30m"
                  className="text-xs sm:text-sm hidden sm:block"
                >
                  30M
                </TabsTrigger>
                <TabsTrigger value="1h" className="text-xs sm:text-sm">
                  1H
                </TabsTrigger>
                <TabsTrigger value="1d" className="text-xs sm:text-sm">
                  1D
                </TabsTrigger>
              </TabsList>
              {["5m", "15m", "30m", "1h", "1d"].map((interval) => (
                <TabsContent
                  key={interval}
                  value={interval}
                  className="mt-3 sm:mt-4"
                >
                  <div className="text-center py-6 sm:py-8 text-muted-foreground">
                    <Activity className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                    <p className="text-sm sm:text-base mb-2">
                      {scanning
                        ? `🔄 Scanning for ${interval} signals...`
                        : `▶️ Start scanning to view ${interval} signals`}
                    </p>
                    {checkedStocks.length > 0 && (
                      <p className="text-xs sm:text-sm text-blue-600 font-medium">
                        {checkedStocks.length} stocks selected for scanning
                      </p>
                    )}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

      </div>
    </>
  );
}
