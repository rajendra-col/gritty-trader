import { useState, useEffect } from "react";
import { toast } from "sonner";
import ApiClient from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Download,
  RotateCcw,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";

interface Record {
  _id: string;
  operation_type: string;
  symbol: string;
  datetime: string;
  interval: string;
  open: number;
  high: number;
  low: number;
  close: number;
  last_low: number;
  last_high: number;
  signal_high: number;
  signal_low: number;
  signal_timestamp: string;
  note: string;
  created_at: string;
}

// RESPONSIVE TradingView Symbol Component
const TradingViewSymbol = ({ symbol }: { symbol: string }) => {
  const cleanSymbol = symbol.replace(".NS", "");
  const tradingViewUrl = `https://in.tradingview.com/chart/?symbol=NSE%3A${cleanSymbol}`;

  return (
    <a
      href={tradingViewUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center text-blue-600 hover:underline font-medium text-xs sm:text-sm"
    >
      <img
        src="https://static.tradingview.com/static/images/favicon.ico"
        alt="TV"
        className="mr-1 h-3 w-3 sm:h-4 sm:w-4"
      />
      <span className="truncate max-w-[80px] sm:max-w-none">{cleanSymbol}</span>
    </a>
  );
};

export default function ViewRecords() {
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInterval, setSelectedInterval] = useState("All Intervals");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(20);

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "", direction: "asc" });

  // All functions remain the same...
  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      // console.log(
      //   "Fetching records from:",
      //   `${ApiClient.getBaseURL()}/api/signals/operations`,
      // );

      const data = await ApiClient.get("/api/signals/operations");
      // console.log("Records data received:", data?.length || 0, "records");

      setRecords(data || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch records";
      console.error("Error fetching records:", errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedInterval, fromDate, toDate, recordsPerPage]);

  const formatDateTime = (dateString: string) => {
    try {
      const d = new Date(dateString);
      const pad = (n: number) => n.toString().padStart(2, "0");

      const day = pad(d.getDate());
      const month = pad(d.getMonth() + 1);
      const year = d.getFullYear();
      const hours = pad(d.getHours());
      const minutes = pad(d.getMinutes());
      const seconds = pad(d.getSeconds());

      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
      return dateString;
    }
  };

  const requestSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const filteredRecords = records
    .filter((record) => {
      const matchesSearch =
        record.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.operation_type.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesInterval =
        selectedInterval === "All Intervals" ||
        record.interval === selectedInterval;

      let matchesDateRange = true;
      if (fromDate || toDate) {
        const recordDate = new Date(record.datetime);
        if (fromDate) {
          const from = new Date(fromDate);
          matchesDateRange = matchesDateRange && recordDate >= from;
        }
        if (toDate) {
          const to = new Date(toDate);
          to.setHours(23, 59, 59, 999);
          matchesDateRange = matchesDateRange && recordDate <= to;
        }
      }

      return matchesSearch && matchesInterval && matchesDateRange;
    })
    .sort((a, b) => {
      if (sortConfig.key) {
        const aVal = a[sortConfig.key as keyof Record];
        const bVal = b[sortConfig.key as keyof Record];

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      }
      return 0;
    });

  const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentRecords = filteredRecords.slice(startIndex, endIndex);

  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);
  const goToNextPage = () =>
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const goToPreviousPage = () =>
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  const goToPage = (page: number) =>
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));

  const getPageNumbers = () => {
    const delta = window.innerWidth < 640 ? 1 : 2; // Fewer pages on mobile
    const start = Math.max(1, currentPage - delta);
    const end = Math.min(totalPages, currentPage + delta);

    const pages = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const getOperationTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "piercingbullish":
        return "bg-green-100 text-green-800 border-green-200";
      case "piercingbearish":
        return "bg-red-100 text-red-800 border-red-200";
      case "gapup":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "gapdown":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "directionalbullish":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "directionalbearish":
        return "bg-rose-100 text-rose-800 border-rose-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getRowColorClass = (operationType: string) => {
    if (
      ["directionalBearish", "piercingBearish", "gapDown"].includes(
        operationType,
      )
    ) {
      return "bg-red-50 hover:bg-red-100";
    }
    if (
      ["directionalBullish", "piercingBullish", "gapUp"].includes(operationType)
    ) {
      return "bg-green-50 hover:bg-green-100";
    }
    return "hover:bg-gray-50";
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedInterval("All Intervals");
    setFromDate("");
    setToDate("");
    setCurrentPage(1);
    setSortConfig({ key: "", direction: "asc" });
  };

  const exportToCSV = () => {
    if (filteredRecords.length === 0) {
      toast.error("No records to export");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(filteredRecords);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Records");
    const excelBuffer = XLSX.write(workbook, {
      type: "array",
      bookType: "xlsx",
    });
    const data = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(data, "operation_records.xlsx");
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 lg:p-6">
      {/* RESPONSIVE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold tracking-tight">
          📊 Operation Records - {records.length}
        </h1>
        <Button
          onClick={fetchRecords}
          disabled={loading}
          variant="outline"
          className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm"
        >
          <RotateCcw
            className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${loading ? "animate-spin" : ""}`}
          />
          <span className="hidden sm:inline">Refresh</span>
          <span className="sm:hidden">Refresh</span>
        </Button>
      </div>

      {/* RESPONSIVE SUMMARY STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Total Records
                </p>
                <p className="text-lg sm:text-2xl font-bold">
                  {records.length}
                </p>
              </div>
              <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Filtered Records
                </p>
                <p className="text-lg sm:text-2xl font-bold">
                  {filteredRecords.length}
                </p>
              </div>
              <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Current Page
                </p>
                <p className="text-lg sm:text-2xl font-bold">
                  {currentRecords.length}
                </p>
              </div>
              <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-6 flex flex-col sm:flex-row gap-2 items-stretch min-w-0">
            {/* wrapper per min-w-0 and full width so buttons don't overflow */}
            <div className="w-full sm:flex-1 min-w-0">
              <Button
                onClick={exportToCSV}
                disabled={filteredRecords.length === 0}
                className="w-full h-8 sm:h-9 text-xs sm:text-sm min-w-0 flex items-center justify-center gap-2 px-2 sm:px-4 whitespace-nowrap"
              >
                <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                {/* long text hidden on mobile, short shown on mobile */}
                <span className="hidden sm:inline truncate">
                  📄 Export Excel
                </span>
                <span className="sm:hidden truncate">Export</span>
              </Button>
            </div>

            <div className="w-full sm:flex-1 min-w-0">
              <Button
                variant="outline"
                onClick={resetFilters}
                className="w-full h-8 sm:h-9 text-xs sm:text-sm min-w-0 flex items-center justify-center gap-2 px-2 sm:px-4 whitespace-nowrap"
              >
                <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline truncate">🔄 Reset</span>
                <span className="sm:hidden truncate">Reset</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RESPONSIVE ERROR DISPLAY */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center gap-2 text-red-800">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="font-medium text-xs sm:text-sm">
                Error loading records: {error}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchRecords}
              className="mt-3 h-8 text-xs"
              disabled={loading}
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* RESPONSIVE FILTERS */}
      <Card>
        <CardHeader className="p-3 sm:pb-6">
          <CardTitle className="text-base sm:text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 sm:top-3 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              <Input
                placeholder="Search symbol/type"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 sm:pl-9 h-8 sm:h-10 text-xs sm:text-sm"
              />
            </div>
            <Select
              value={selectedInterval}
              onValueChange={setSelectedInterval}
            >
              <SelectTrigger className="h-8 sm:h-10 text-xs sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Intervals">All Intervals</SelectItem>
                <SelectItem value="1m">1m</SelectItem>
                <SelectItem value="5m">5m</SelectItem>
                <SelectItem value="15m">15m</SelectItem>
                <SelectItem value="1h">1h</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              placeholder="From Date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-8 sm:h-10 text-xs sm:text-sm"
            />
            <Input
              type="date"
              placeholder="To Date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-8 sm:h-10 text-xs sm:text-sm"
            />
            <Select
              value={recordsPerPage.toString()}
              onValueChange={(value) => setRecordsPerPage(Number(value))}
            >
              <SelectTrigger className="h-8 sm:h-10 text-xs sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 per page</SelectItem>
                <SelectItem value="20">20 per page</SelectItem>
                <SelectItem value="50">50 per page</SelectItem>
                <SelectItem value="100">100 per page</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* RESPONSIVE RECORDS TABLE */}
      <Card>
        <CardHeader className="p-3 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-base sm:text-lg">Records</CardTitle>
            <div className="text-xs sm:text-sm text-muted-foreground">
              Showing {startIndex + 1}-
              {Math.min(endIndex, filteredRecords.length)} of{" "}
              {filteredRecords.length}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin mr-2" />
              <span className="text-sm sm:text-base">Loading records...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-100 dark:bg-blue-900">
                    {[
                      { key: "symbol", label: "SYMBOL" },
                      { key: "operation_type", label: "TYPE" },
                      { key: "interval", label: "INT" },
                      { key: "last_high", label: "L.HIGH" },
                      { key: "last_low", label: "L.LOW" },
                      { key: "datetime", label: "DATETIME" },
                      { key: "open", label: "OPEN" },
                      { key: "high", label: "HIGH" },
                      { key: "low", label: "LOW" },
                      { key: "close", label: "CLOSE" },
                      { key: "signal_timestamp", label: "S.TIME" },
                      { key: "signal_high", label: "S.HIGH" },
                      { key: "signal_low", label: "S.LOW" },
                      { key: "note", label: "NOTE" },
                    ].map((col) => (
                      <TableHead
                        key={col.key}
                        onClick={() => requestSort(col.key)}
                        className="cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800 select-none font-semibold text-xs sm:text-sm min-w-[80px] sm:min-w-[100px]"
                      >
                        <div className="flex items-center gap-1">
                          <span className="truncate">{col.label}</span>
                          {sortConfig.key === col.key && (
                            <span className="text-xs">
                              {sortConfig.direction === "asc" ? "🔼" : "🔽"}
                            </span>
                          )}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentRecords.map((record) => (
                    <TableRow
                      key={record._id}
                      className={`border-b ${getRowColorClass(record.operation_type)}`}
                    >
                      <TableCell className="font-medium min-w-[100px] p-2 sm:p-4">
                        <TradingViewSymbol symbol={record.symbol} />
                      </TableCell>
                      <TableCell className="min-w-[120px] p-2 sm:p-4">
                        <Badge
                          className={`${getOperationTypeColor(record.operation_type)} text-xs px-1 py-0.5`}
                        >
                          <span className="truncate max-w-[80px] sm:max-w-none">
                            {record.operation_type}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell className="p-2 sm:p-4">
                        <Badge
                          variant="outline"
                          className="text-xs px-1 py-0.5"
                        >
                          {record.interval}
                        </Badge>
                      </TableCell>
                      <TableCell className="bg-pink-50 p-2 sm:p-4 text-xs sm:text-sm">
                        {Number(record.last_high).toFixed(2)}
                      </TableCell>
                      <TableCell className="bg-pink-50 p-2 sm:p-4 text-xs sm:text-sm">
                        {Number(record.last_low).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs bg-yellow-50 min-w-[120px] sm:min-w-[150px] p-2 sm:p-4">
                        <div className="truncate">
                          {formatDateTime(record.datetime)}
                        </div>
                      </TableCell>
                      <TableCell className="bg-yellow-50 p-2 sm:p-4 text-xs sm:text-sm">
                        {Number(record.open).toFixed(2)}
                      </TableCell>
                      <TableCell className="bg-yellow-50 p-2 sm:p-4 text-xs sm:text-sm">
                        {Number(record.high).toFixed(2)}
                      </TableCell>
                      <TableCell className="bg-yellow-50 p-2 sm:p-4 text-xs sm:text-sm">
                        {Number(record.low).toFixed(2)}
                      </TableCell>
                      <TableCell className="bg-yellow-50 p-2 sm:p-4 text-xs sm:text-sm">
                        {Number(record.close).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs bg-blue-50 min-w-[120px] sm:min-w-[150px] p-2 sm:p-4">
                        <div className="truncate">
                          {record.signal_timestamp
                            ? formatDateTime(record.signal_timestamp)
                            : "-"}
                        </div>
                      </TableCell>
                      <TableCell className="bg-blue-50 p-2 sm:p-4 text-xs sm:text-sm">
                        {Number(record.signal_high).toFixed(2)}
                      </TableCell>
                      <TableCell className="bg-blue-50 p-2 sm:p-4 text-xs sm:text-sm">
                        {Number(record.signal_low).toFixed(2)}
                      </TableCell>
                      <TableCell className="min-w-[100px] sm:min-w-[150px] p-2 sm:p-4">
                        <div className="text-xs italic truncate max-w-[100px] sm:max-w-none">
                          {record.note || "-"}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!loading && filteredRecords.length === 0 && !error && (
            <div className="text-center py-8 text-muted-foreground px-4">
              <FileText className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm sm:text-base">
                No records found matching your criteria
              </p>
            </div>
          )}

          {/* RESPONSIVE PAGINATION CONTROLS */}
          {!loading && filteredRecords.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 p-4 sm:p-0">
              <div className="text-xs sm:text-sm text-muted-foreground order-2 sm:order-1">
                Page {currentPage} of {totalPages} ({filteredRecords.length}{" "}
                total)
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
    </div>
  );
}
