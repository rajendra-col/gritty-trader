import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Wishlist { 
  _id: string; 
  name: string;
}

// Fix: Environment variable access based on your build tool
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8090'; // For Vite
// const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8090'; // For CRA
// const API_BASE_URL = 'http://localhost:8090'; // Simple hardcode

async function fetchWishlists(): Promise<Wishlist[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/wishlist-categories`);
    if (!response.ok) throw new Error('Failed to fetch wishlists');
    const data = await response.json();
    return data.data || data;
  } catch (error) {
    console.error('Error fetching wishlists:', error);
    return [];
  }
}

async function createWishlist(name: string): Promise<Wishlist | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/wishlist-categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error('Failed to create wishlist');
    const data = await response.json();
    return data.data || data;
  } catch (error) {
    console.error('Error creating wishlist:', error);
    return null;
  }
}

// Fetch stock's current watchlist memberships using optimized API
async function fetchStockWatchlistMemberships(stockId: string): Promise<string[]> {
  try {
    // Use the new API endpoint to get stock details with populated wishlist categories
    const stockResponse = await fetch(`${API_BASE_URL}/api/stock/${stockId}`);
    
    if (!stockResponse.ok) {
      console.warn('Stock API not available, falling back to manual check');
      return await fetchStockWatchlistMembershipsManual(stockId);
    }
    
    const stockData = await stockResponse.json();
    
    if (!stockData.success || !stockData.data) {
      return [];
    }
    
    const stock = stockData.data;
    const memberships: string[] = [];
    
    // Check if stock is in default watchlist
    if (stock.isWatchlist) {
      memberships.push('default');
    }
    
    // Get wishlist category IDs from populated data
    if (stock.wishlistCategory && Array.isArray(stock.wishlistCategory)) {
      const categoryIds = stock.wishlistCategory.map((cat: any) => {
        // Handle both populated and non-populated responses
        return typeof cat === 'string' ? cat : cat._id;
      });
      memberships.push(...categoryIds);
    }
    
    return memberships;
  } catch (error) {
    console.error('Error fetching stock memberships (optimized):', error);
    // Fallback to manual method
    return await fetchStockWatchlistMembershipsManual(stockId);
  }
}

// Fallback method for manual membership checking
async function fetchStockWatchlistMembershipsManual(stockId: string): Promise<string[]> {
  try {
    // First, check if stock is in default watchlist by checking stock data
    let isInDefault = false;
    try {
      const defaultCheckResponse = await fetch(`${API_BASE_URL}/api/stock/all`);
      if (defaultCheckResponse.ok) {
        const allStocks = await defaultCheckResponse.json();
        const targetStock = allStocks.find((s: any) => s._id === stockId);
        isInDefault = targetStock?.isWatchlist || false;
      }
    } catch (e) {
      console.warn('Could not check default watchlist status');
    }
    
    // Get all watchlist categories
    const categoriesResponse = await fetch(`${API_BASE_URL}/api/wishlist-categories`);
    if (!categoriesResponse.ok) return isInDefault ? ['default'] : [];
    
    const categoriesData = await categoriesResponse.json();
    const categories = categoriesData.data || categoriesData;
    
    const membershipPromises = categories.map(async (category: Wishlist) => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/wishlist-categories/stocks/${category._id}?page=1&limit=1000`);
        if (!response.ok) return null;
        
        const data = await response.json();
        const stocks = data.data || [];
        
        // Check if our stock is in this category
        const isInCategory = stocks.some((stock: any) => stock._id === stockId);
        return isInCategory ? category._id : null;
      } catch (error) {
        console.error(`Error checking category ${category._id}:`, error);
        return null;
      }
    });
    
    const results = await Promise.all(membershipPromises);
    const memberCategories = results.filter((id): id is string => id !== null);
    
    // Add 'default' to the list if stock is in default watchlist
    if (isInDefault) {
      memberCategories.push('default');
    }
    
    return memberCategories;
  } catch (error) {
    console.error('Error fetching stock watchlist memberships (manual):', error);
    return [];
  }
}

async function addStockToWishlists(stockId: string, wishlistIds: string[]): Promise<boolean> {
  try {
    const promises = wishlistIds.map(async (wishlistId) => {
      const response = await fetch(`${API_BASE_URL}/api/wishlist-categories/stocks/add/${stockId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // send array under lowercase key
        body: JSON.stringify({ categoryIds: [wishlistId] }),
      });
      return response.ok;
    });

    const results = await Promise.all(promises);
    return results.every(result => result === true);
  } catch (error) {
    console.error('Error adding stock to wishlists:', error);
    return false;
  }
}

export default function MultiWatchlistDialog({
  open,
  onOpenChange,
  symbol,
  stockId,
  onConfirm,
  defaultAlsoAdd = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string;
  stockId: string;
  onConfirm: (result: { listIds: string[]; alsoDefault: boolean }) => void;
  defaultAlsoAdd?: boolean;
}) {
  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [newListName, setNewListName] = useState("");
  const [alsoDefault, setAlsoDefault] = useState(defaultAlsoAdd);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [currentMemberships, setCurrentMemberships] = useState<string[]>([]);
  const [fetchingMemberships, setFetchingMemberships] = useState(false);

  useEffect(() => {
    if (!open || !stockId) return;
    
    const loadWishlistsAndMemberships = async () => {
      setLoading(true);
      setFetchingMemberships(true);
      
      try {
        // Load wishlists and current memberships in parallel
        const [lists, memberships] = await Promise.all([
          fetchWishlists(),
          fetchStockWatchlistMemberships(stockId)
        ]);
        
        setWishlists(lists);
        setCurrentMemberships(memberships);
        
        // Pre-select current memberships (excluding 'default')
        const categoryMemberships = memberships.filter(id => id !== 'default');
        setSelected(categoryMemberships);
        
        // Set default checkbox based on current membership
        const isInDefault = memberships.includes('default');
        setAlsoDefault(isInDefault || defaultAlsoAdd);
        
      } catch (error) {
        console.error('Error loading wishlists and memberships:', error);
        // Fallback to just loading wishlists
        try {
          const lists = await fetchWishlists();
          setWishlists(lists);
          setSelected([]);
          setAlsoDefault(defaultAlsoAdd);
        } catch (fallbackError) {
          console.error('Error in fallback loading:', fallbackError);
        }
      } finally {
        setLoading(false);
        setFetchingMemberships(false);
      }
    };

    loadWishlistsAndMemberships();
  }, [open, symbol, stockId, defaultAlsoAdd]);

  const canCreate = useMemo(() => newListName.trim().length > 0 && !creating, [newListName, creating]);

  const createList = async () => {
    if (!canCreate) return;
    
    setCreating(true);
    try {
      const newWishlist = await createWishlist(newListName.trim());
      if (newWishlist) {
        setWishlists(prev => [...prev, newWishlist]);
        setSelected(prev => [...prev, newWishlist._id]);
        setNewListName("");
      }
    } catch (error) {
      console.error('Error creating wishlist:', error);
    } finally {
      setCreating(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (selected.length > 0) {
        const success = await addStockToWishlists(stockId, selected);
        if (!success) {
          console.error('Failed to add stock to some wishlists');
        }
      }
      
      onConfirm({ listIds: selected, alsoDefault });
      onOpenChange(false);
    } catch (error) {
      console.error('Error confirming selection:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to Watchlists</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm flex items-center gap-2">
            Symbol: <Badge variant="secondary">{symbol}</Badge>
            {fetchingMemberships && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                Loading memberships...
              </div>
            )}
          </div>
          
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label htmlFor="new-list">Create new list</Label>
              <Input 
                id="new-list" 
                value={newListName} 
                onChange={(e) => setNewListName(e.target.value)} 
                placeholder="e.g., Momentum"
                disabled={creating}
              />
            </div>
            <Button 
              onClick={createList} 
              disabled={!canCreate}
            >
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </div>
          
          <div className="space-y-2">
            <Label>Select lists</Label>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading wishlists...</div>
            ) : wishlists.length === 0 ? (
              <div className="text-sm text-muted-foreground">No lists yet. Create one above.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {wishlists.map((wl) => {
                  const isCurrentMember = currentMemberships.includes(wl._id);
                  const isSelected = selected.includes(wl._id);
                  
                  return (
                    <label 
                      key={wl._id} 
                      className={`flex items-center gap-2 border rounded p-2 cursor-pointer transition-colors ${
                        isCurrentMember 
                          ? 'border-green-300 bg-green-50' 
                          : isSelected 
                            ? 'border-blue-300 bg-blue-50' 
                            : 'hover:border-gray-300'
                      }`}
                    >
                      <Checkbox 
                        checked={isSelected} 
                        onCheckedChange={() => toggleSelect(wl._id)} 
                      />
                      <span className="text-sm flex-1">{wl.name}</span>
                      {isCurrentMember && (
                        <Badge variant="outline" className="text-xs px-1 py-0.5 bg-green-100 text-green-700">
                          ✓ Added
                        </Badge>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          
          <label className={`flex items-center gap-2 p-2 rounded border transition-colors ${
            currentMemberships.includes('default') 
              ? 'border-green-300 bg-green-50' 
              : alsoDefault 
                ? 'border-blue-300 bg-blue-50' 
                : 'border-gray-200'
          }`}>
            <Checkbox checked={alsoDefault} onCheckedChange={(v) => setAlsoDefault(v === true)} />
            <span className="text-sm flex-1">Also add to default Watchlist</span>
            {currentMemberships.includes('default') && (
              <Badge variant="outline" className="text-xs px-1 py-0.5 bg-green-100 text-green-700">
                ✓ Added
              </Badge>
            )}
          </label>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? 'Adding...' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
