import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Trash2,
  ArrowLeft,
  Loader2,
  RotateCcw,
  Star,
  Heart,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import ApiClient from "@/lib/apiClient";

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

// 🔥 BACKEND: Updated interface for backend integration
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
}

export default function RecycleBin() {
  const navigate = useNavigate();
  const [deletedCategories, setDeletedCategories] = useState<WatchlistCategory[]>([]);
  const [activeCategories, setActiveCategories] = useState<WatchlistCategory[]>([]);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(null);
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // 🔥 BACKEND: Fetch watchlist categories (deleted ones for recycle bin)
  const fetchWatchlistCategories = useCallback(async () => {
    setLoading(true);
    try {
      const response: WatchlistCategoryResponse = await ApiClient.get('/api/watchlist-categories');
      if (response.success && Array.isArray(response.data)) {
        const deleted = response.data.filter(cat => cat.isDeleted);
        const active = response.data.filter(cat => !cat.isDeleted);
        setDeletedCategories(deleted);
        setActiveCategories(active);
        
        // Auto-select first deleted watchlist if available
        if (deleted.length > 0 && !selectedWatchlistId) {
          setSelectedWatchlistId(deleted[0]._id);
        }
      }
    } catch (error) {
      console.error("Error loading recycle bin data:", error);
      toast.error("Failed to load recycle bin data");
    } finally {
      setLoading(false);
    }
  }, [selectedWatchlistId]);

  useEffect(() => {
    fetchWatchlistCategories();
  }, [fetchWatchlistCategories]);

  // Check if watchlist name already exists in active watchlists
  const isNameExists = useCallback((name: string) => {
    return activeCategories.some(list => 
      list.name.toLowerCase() === name.toLowerCase()
    );
  }, [activeCategories]);

  // 🔥 BACKEND: Restore from recycle bin
  const restoreFromRecycleBin = async (id: string) => {
    const watchlistToRestore = deletedCategories.find(list => list._id === id);
    if (!watchlistToRestore) return;

    // Check if name exists before restoring
    if (isNameExists(watchlistToRestore.name)) {
      toast.error("Cannot restore: A watchlist with this name already exists");
      return;
    }

    try {
      const response = await ApiClient.put(`/api/watchlist-categories/${id}/restore`);
      if (response.success) {
        await fetchWatchlistCategories();
        
        // If this was selected watchlist, select another one or null
        if (selectedWatchlistId === id) {
          const remaining = deletedCategories.filter(cat => cat._id !== id);
          setSelectedWatchlistId(remaining.length > 0 ? remaining[0]._id : null);
        }
        
        toast.success(`Watchlist "${watchlistToRestore.name}" restored successfully!`);
      }
    } catch (error: any) {
      console.error("Error restoring watchlist category:", error);
      if (error?.response?.data?.message?.includes('already exists')) {
        toast.error("Cannot restore: A watchlist with this name already exists");
      } else {
        toast.error("Failed to restore watchlist category");
      }
    }
  };

  // 🔥 BACKEND: Permanently delete from recycle bin
  const permanentlyDelete = async (id: string) => {
    const watchlistToDelete = deletedCategories.find(list => list._id === id);
    if (!watchlistToDelete) return;

    try {
      const response = await ApiClient.delete(`/api/watchlist-categories/${id}/permanent`);
      if (response.success) {
        await fetchWatchlistCategories();
        
        // If this was selected watchlist, select another one or null
        if (selectedWatchlistId === id) {
          const remaining = deletedCategories.filter(cat => cat._id !== id);
          setSelectedWatchlistId(remaining.length > 0 ? remaining[0]._id : null);
        }
        
        toast.success(`Watchlist "${watchlistToDelete.name}" permanently deleted`);
      }
    } catch (error) {
      console.error("Error permanently deleting watchlist category:", error);
      toast.error("Failed to permanently delete watchlist category");
    }
  };

  // Handle tab change
  const handleTabChange = (value: string) => {
    setSelectedWatchlistId(value);
    setSelectedStocks([]);
  };

  const getCurrentWatchlist = () => {
    if (!selectedWatchlistId) return null;
    return deletedCategories.find(list => list._id === selectedWatchlistId);
  };

  const getCurrentWatchlistName = () => {
    const currentList = getCurrentWatchlist();
    return currentList ? currentList.name : "Unknown Watchlist";
  };

  const handleStockSelection = useCallback((stockId: string) => {
    setSelectedStocks(prev =>
      prev.includes(stockId)
        ? prev.filter(id => id !== stockId)
        : [...prev, stockId]
    );
  }, []);

  const handleSelectAll = useCallback((checked: boolean) => {
    const currentWatchlist = getCurrentWatchlist();
    if (!currentWatchlist || !Array.isArray(currentWatchlist.stocks)) return;
    
    setSelectedStocks(checked ? currentWatchlist.stocks.map(stock => stock._id) : []);
  }, [getCurrentWatchlist]);

  // 🔥 BACKEND: Remove selected stocks permanently from deleted watchlist
  const handleDeleteSelectedStocks = async () => {
    const currentWatchlist = getCurrentWatchlist();
    if (!currentWatchlist || selectedStocks.length === 0) return;

    try {
      // Remove stocks from the deleted watchlist category
      const removePromises = selectedStocks.map(stockId =>
        ApiClient.delete(`/api/watchlist-categories/${currentWatchlist._id}/remove-stock/${stockId}`)
      );
      
      await Promise.all(removePromises);
      await fetchWatchlistCategories();
      setSelectedStocks([]);
      toast.success(`${selectedStocks.length} stocks permanently deleted from watchlist`);
    } catch (error) {
      console.error("Error removing stocks from watchlist:", error);
      toast.error("Failed to remove stocks from watchlist");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span>Loading recycle bin...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button 
            onClick={() => navigate('/watchlist')} 
            variant="outline" 
            size="sm"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Watchlist
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">🗑️ Recycle Bin</h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchWatchlistCategories} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Recycle Bin Content */}
      <Card>
        <CardContent className="p-0">
          {deletedCategories.length === 0 ? (
            <div className="text-center py-12">
              <Trash2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Recycle Bin is Empty</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                No deleted watchlists found. When you delete watchlists, they will appear here for recovery.
              </p>
              <Button 
                onClick={() => navigate('/watchlist')} 
                className="mt-4"
                variant="outline"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Watchlist
              </Button>
            </div>
          ) : (
            <Tabs value={selectedWatchlistId || ""} onValueChange={handleTabChange} className="w-full">
              <div className="border-b">
                <TabsList className="w-full justify-start rounded-none bg-transparent p-0 h-auto">
                  {deletedCategories.map((list) => (
                    <TabsTrigger
                      key={list._id}
                      value={list._id}
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-red-500 data-[state=active]:bg-transparent px-6 py-3"
                    >
                      <Trash2 className="h-4 w-4 mr-2 text-red-500" />
                      {list.name} ({Array.isArray(list.stocks) ? list.stocks.length : 0})
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {deletedCategories.map((list) => (
                <TabsContent key={list._id} value={list._id} className="mt-0">
                  <div className="p-6">
                    {/* Watchlist Actions */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-red-600">{list.name}</h3>
                        <Badge variant="outline" className="text-red-600 border-red-600">
                          {Array.isArray(list.stocks) ? list.stocks.length : 0} stocks (Deleted)
                        </Badge>
                        {list.deletedAt && (
                          <Badge variant="outline" className="text-xs">
                            Deleted: {new Date(list.deletedAt).toLocaleDateString()}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => restoreFromRecycleBin(list._id)}
                          className="text-green-600 border-green-600 hover:bg-green-50"
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Restore Watchlist
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Forever
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Permanently Delete Watchlist</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to permanently delete "{list.name}"? This action cannot be undone and all stocks in this watchlist will be lost forever.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => permanentlyDelete(list._id)}
                                className="bg-red-600 text-white hover:bg-red-700"
                              >
                                Delete Forever
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    {/* Stocks Table */}
                    {!Array.isArray(list.stocks) || list.stocks.length === 0 ? (
                      <div className="text-center py-12">
                        <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <h3 className="text-lg font-semibold mb-2">No Records Available</h3>
                        <p className="text-muted-foreground max-w-md mx-auto">
                          This deleted watchlist "{list.name}" contains no stocks.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`select-all-${list._id}`}
                              checked={selectedStocks.length === list.stocks.length && list.stocks.length > 0}
                              onCheckedChange={(checked) => handleSelectAll(checked === true)}
                            />
                            <Label htmlFor={`select-all-${list._id}`} className="text-sm">Select All</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedStocks.length > 0 && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="destructive">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Selected ({selectedStocks.length})
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Permanently Delete Stocks</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to permanently delete {selectedStocks.length} selected stocks from this watchlist? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={handleDeleteSelectedStocks}
                                      className="bg-red-600 text-white hover:bg-red-700"
                                    >
                                      Delete Forever
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            <div className="text-sm text-muted-foreground">
                              {selectedStocks.length > 0 && `${selectedStocks.length} selected`}
                            </div>
                          </div>
                        </div>

                        <ScrollArea className="h-[400px] w-full">
                          <div className="min-w-[800px]">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[50px]">Select</TableHead>
                                  <TableHead>Symbol</TableHead>
                                  <TableHead>Stock Name</TableHead>
                                  <TableHead>Range</TableHead>
                                  <TableHead>Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {list.stocks.map((stock) => (
                                  <TableRow key={stock._id}>
                                    <TableCell>
                                      <Checkbox
                                        checked={selectedStocks.includes(stock._id)}
                                        onCheckedChange={() => handleStockSelection(stock._id)}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="secondary">{stock.Symbol}</Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">{stock.StockName}</TableCell>
                                    <TableCell>{stock.Range}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="text-red-600 border-red-600">
                                        In Deleted Watchlist
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </ScrollArea>
                      </>
                    )}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
