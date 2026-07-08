import { Request, Response } from "express";

export interface Stock {
  id: string;
  Symbol: string;
  StockName: string;
  Range: number;
  createdAt: string;
  updatedAt: string;
}

// Sample stock data as provided by the user
let stocksDatabase: Stock[] = [
  {
    id: "1",
    Symbol: "NIFTY",
    StockName: "Nifty",
    Range: 50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "2",
    Symbol: "BANKNIFTY",
    StockName: "Bank Nifty",
    Range: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "3",
    Symbol: "CNXFINANCE",
    StockName: "Fin Nifty",
    Range: 50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "4",
    Symbol: "MIDCPNIFTY1!",
    StockName: "Midcp Nifty",
    Range: 25,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "5",
    Symbol: "Aartiind",
    StockName: "Aarti Industries Limited",
    Range: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "6",
    Symbol: "ABB",
    StockName: "ABB India Limited",
    Range: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "7",
    Symbol: "ABCAPITAL",
    StockName: "Aditya Birla Capital Limited",
    Range: 2.5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "8",
    Symbol: "ABFRL",
    StockName: "Aditya Birla Fashion and Retail Limited",
    Range: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "9",
    Symbol: "ACC",
    StockName: "ACC Limited",
    Range: 20,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "10",
    Symbol: "ADANIENSOL",
    StockName: "Adani Energy Solutions Limited",
    Range: 20,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Generate unique ID
const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

// GET /api/stocks - Get all stocks with optional search and sort
export const getAllStocks = (req: Request, res: Response) => {
  try {
    const { search, sortBy = 'StockName', sortOrder = 'asc' } = req.query;
    
    let stocks = [...stocksDatabase];

    // Apply search filter
    if (search && typeof search === 'string') {
      const searchTerm = search.toLowerCase();
      stocks = stocks.filter(stock => 
        stock.Symbol.toLowerCase().includes(searchTerm) ||
        stock.StockName.toLowerCase().includes(searchTerm)
      );
    }

    // Apply sorting
    if (sortBy && typeof sortBy === 'string') {
      stocks.sort((a, b) => {
        const aValue = a[sortBy as keyof Stock];
        const bValue = b[sortBy as keyof Stock];
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          const comparison = aValue.localeCompare(bValue);
          return sortOrder === 'desc' ? -comparison : comparison;
        }
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          const comparison = aValue - bValue;
          return sortOrder === 'desc' ? -comparison : comparison;
        }
        
        return 0;
      });
    }

    res.json({
      success: true,
      data: stocks,
      total: stocks.length,
      message: 'Stocks retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching stocks:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// GET /api/stocks/:id - Get stock by ID
export const getStockById = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const stock = stocksDatabase.find(s => s.id === id);

    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Stock not found'
      });
    }

    res.json({
      success: true,
      data: stock,
      message: 'Stock retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching stock:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// POST /api/stocks - Create new stock
export const createStock = (req: Request, res: Response) => {
  try {
    const { Symbol, StockName, Range } = req.body;

    // Validation
    if (!Symbol || !StockName || typeof Range !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Symbol, StockName, and Range are required. Range must be a number.'
      });
    }

    // Check if stock with same symbol already exists
    const existingStock = stocksDatabase.find(s => s.Symbol.toUpperCase() === Symbol.toUpperCase());
    if (existingStock) {
      return res.status(409).json({
        success: false,
        message: 'Stock with this symbol already exists'
      });
    }

    const newStock: Stock = {
      id: generateId(),
      Symbol: Symbol.trim().toUpperCase(),
      StockName: StockName.trim(),
      Range: Number(Range),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    stocksDatabase.push(newStock);

    res.status(201).json({
      success: true,
      data: newStock,
      message: 'Stock created successfully'
    });
  } catch (error) {
    console.error('Error creating stock:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// PUT /api/stocks/:id - Update stock
export const updateStock = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { Symbol, StockName, Range } = req.body;

    const stockIndex = stocksDatabase.findIndex(s => s.id === id);
    if (stockIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Stock not found'
      });
    }

    // Validation
    if (!Symbol || !StockName || typeof Range !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Symbol, StockName, and Range are required. Range must be a number.'
      });
    }

    // Check if another stock with same symbol exists (excluding current stock)
    const existingStock = stocksDatabase.find(s => 
      s.Symbol.toUpperCase() === Symbol.toUpperCase() && s.id !== id
    );
    if (existingStock) {
      return res.status(409).json({
        success: false,
        message: 'Another stock with this symbol already exists'
      });
    }

    const updatedStock: Stock = {
      ...stocksDatabase[stockIndex],
      Symbol: Symbol.trim().toUpperCase(),
      StockName: StockName.trim(),
      Range: Number(Range),
      updatedAt: new Date().toISOString()
    };

    stocksDatabase[stockIndex] = updatedStock;

    res.json({
      success: true,
      data: updatedStock,
      message: 'Stock updated successfully'
    });
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// DELETE /api/stocks/:id - Delete stock
export const deleteStock = (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const stockIndex = stocksDatabase.findIndex(s => s.id === id);
    if (stockIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Stock not found'
      });
    }

    const deletedStock = stocksDatabase[stockIndex];
    stocksDatabase.splice(stockIndex, 1);

    res.json({
      success: true,
      data: deletedStock,
      message: 'Stock deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting stock:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// DELETE /api/stocks - Delete multiple stocks
export const deleteMultipleStocks = (req: Request, res: Response) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Array of stock IDs is required'
      });
    }

    const deletedStocks: Stock[] = [];
    const initialLength = stocksDatabase.length;

    // Remove stocks with matching IDs
    stocksDatabase = stocksDatabase.filter(stock => {
      if (ids.includes(stock.id)) {
        deletedStocks.push(stock);
        return false;
      }
      return true;
    });

    const deletedCount = initialLength - stocksDatabase.length;

    res.json({
      success: true,
      data: deletedStocks,
      deletedCount,
      message: `${deletedCount} stock(s) deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting multiple stocks:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// GET /api/stocks/symbols - Get only symbols (for compatibility with existing code)
export const getStockSymbols = (req: Request, res: Response) => {
  try {
    const symbols = stocksDatabase.map(stock => ({
      Symbol: stock.Symbol,
      StockName: stock.StockName,
      Range: stock.Range
    }));

    res.json(symbols);
  } catch (error) {
    console.error('Error fetching stock symbols:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
