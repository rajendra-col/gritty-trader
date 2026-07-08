import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import {
  getAllStocks,
  getStockById,
  createStock,
  updateStock,
  deleteStock,
  deleteMultipleStocks,
  getStockSymbols
} from "./routes/stocks";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Stock management routes
  app.get("/api/stocks", getAllStocks);
  app.get("/api/stocks/symbols", getStockSymbols); // For compatibility with existing code
  app.get("/api/stocks/:id", getStockById);
  app.post("/api/stocks", createStock);
  app.put("/api/stocks/:id", updateStock);
  app.delete("/api/stocks/:id", deleteStock);
  app.delete("/api/stocks", deleteMultipleStocks);

  return app;
}
