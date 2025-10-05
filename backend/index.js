import express from "express";
import dotenv from "dotenv";
import cron from "node-cron";
// import { scrapeEpicGames, scrapeFreeEpicGames } from "./scrappers/epicScraper.js";
import { scrapeAllEpicGames } from "./scrappers/epicScraper.js";
// import scrapePrimeGames from "./scrappers/primeScraper.js";
import {
  scrapeAllPrimeGaming
} from "./scrappers/primeScraper.js";
import { scrapeSteamFreeGames,
    scrapeSteamHighlyDiscounted,
    scrapeSteamBudgetGames,
    scrapeAllSteamGames
 } from "./scrappers/steamScraper.js";
// import { scrapeGOGFreeGames, scrapeGOGGiveaway} from "./scrappers/gogScraper.js";
import {
    scrapeGOGGiveaway,
    scrapeGOGFreeGames,
    scrapeGOGHighlyDiscounted,
    scrapeAllGOGGames
} from "./scrappers/gogScraper.js"
import { deleteExpiredGames } from "./controller/game.controller.js";
import mongoose from "mongoose";
import gameRoutes from "./route/game.route.js";
import path from "path";
import cors from "cors";

const app = express();
dotenv.config();

const PORT = process.env.PORT || 5500;

const CONNECTION_STRING = process.env.MONGO_CONNECTION_STRING;
if (!CONNECTION_STRING) {
  console.error(
    "MONGO_CONNECTION_STRING is not defined in the environment variables"
  );
  process.exit(1);
}

mongoose
  .connect(CONNECTION_STRING)
  .then(() => console.log("Connected to MongoDB"))
  .catch((error) => console.error("Error connecting to MongoDB:", error));

app.use(express.json());

app.use(cors());

app.use("/api/games", gameRoutes);

// Lightweight health endpoint for readiness/liveness probes
app.get('/health', (req, res) => {
  // simple check: if mongoose connection is ready
  const readyState = mongoose.connection.readyState; // 1 = connected
  if (readyState === 1) {
    return res.status(200).json({ status: 'ok' });
  }
  return res.status(503).json({ status: 'unavailable', mongooseState: readyState });
});

app.post('/trigger-scrape', async (req, res) => {
    try {
        await runScrapers();
        res.status(200).json({ message: "Scraping triggered successfully." });
    } catch (error) {
        console.error("Error triggering scraping:", error);
        res.status(500).json({ message: "Internal server error." });
    }
});


// Serve static assets in production
// if (process.env.NODE_ENV === "production") {
//   console.log("Serving static assets in production...");
//   app.use(express.static(path.join(path.resolve(), "/frontend/build")));

//   app.get("*", (req, res) => {
//     res.sendFile(
//       path.resolve(path.resolve(), "frontend", "build", "index.html")
//     );
//   });
// }

// Run all scrapers
const runScrapers = async () => {
  try {
    await scrapeAllEpicGames();
    await scrapeAllPrimeGaming();
    await scrapeAllSteamGames();
    await scrapeAllGOGGames();
    console.log("Scraping process completed successfully.");
  } catch (error) {
    console.error("Error during scraping process:", error.message, error.stack);
  }
};

// // Schedule scrapers to run every day at 4:00 AM
cron.schedule("01 11 * * *", runScrapers, {
  scheduled: true,
  timezone: "America/New_York",
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`NODE_ENV=${process.env.NODE_ENV || 'not set'}`);
});
