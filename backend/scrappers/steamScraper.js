import { By, until } from "selenium-webdriver";
import { createDriver } from "../utils/util.js";
import { addGames, deleteAllGames } from "../controller/game.controller.js";

// ========== HELPER FUNCTIONS ==========

// Extract categories from Steam store page
async function extractSteamCategories(driver) {
    const categories = new Set();
    const features = new Set();
    
    try {
        // Wait for page to load
        await driver.sleep(2000);
        
        // Method 1: Get tags from the Steam page
        try {
            // Popular user-defined tags
            const tagElements = await driver.findElements(By.css(".app_tag, .glance_tags a, .popular_tags a"));
            for (const element of tagElements) {
                const text = await element.getText();
                if (text && text.length > 1 && text.length < 30) {
                    categories.add(text.trim());
                }
            }
        } catch {}
        
        // Method 2: Get genres from details section
        try {
            const genreElements = await driver.findElements(By.css(".details_block a[href*='genre'], .game_area_details_specs a"));
            for (const element of genreElements) {
                const text = await element.getText();
                if (text && text.length > 1) {
                    categories.add(text.trim());
                }
            }
        } catch {}
        
        // Method 3: Get features (Single-player, Multiplayer, etc.)
        try {
            const featureElements = await driver.findElements(By.css(".game_area_features_list_ctn .label, .game_area_details_specs .name"));
            for (const element of featureElements) {
                const text = await element.getText();
                if (text) {
                    features.add(text.trim());
                }
            }
        } catch {}
        
        // Add Steam-specific features
        try {
            // Check for VR support
            const vrElements = await driver.findElements(By.css("[class*='vr_supported'], .game_area_details_specs a[href*='vr']"));
            if (vrElements.length > 0) {
                features.add('VR Support');
            }
            
            // Check for Steam Deck compatibility
            const deckElements = await driver.findElements(By.css(".game_area_details_specs a[href*='deck'], [class*='deck_compatibility']"));
            if (deckElements.length > 0) {
                features.add('Steam Deck Compatible');
            }
        } catch {}
        
    } catch (error) {
        console.error(`Error extracting Steam categories: ${error.message}`);
    }
    
    // Add default features if none found
    if (features.size === 0) {
        features.add('Steam Cloud');
        features.add('Steam Achievements');
    }
    
    return { 
        categories: Array.from(categories), 
        features: Array.from(features) 
    };
}

// Extract categories using Google as fallback
async function extractCategoriesFromGoogle(driver, gameTitle) {
    const categories = new Set();
    const features = new Set();
    
    try {
        const searchQuery = `${gameTitle} steam game genre type`;
        const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
        
        await driver.get(googleUrl);
        await driver.sleep(2000);
        
        const searchResults = await driver.findElements(By.css('.g, .tF2Cxc'));
        let relevantText = '';
        
        for (let i = 0; i < Math.min(3, searchResults.length); i++) {
            try {
                const text = await searchResults[i].getText();
                relevantText += ' ' + text;
            } catch {}
        }
        
        const genreKeywords = [
            'Action', 'Adventure', 'Casual', 'Indie', 'RPG', 'Simulation',
            'Strategy', 'Racing', 'Sports', 'Puzzle', 'Platformer',
            'Shooter', 'Horror', 'Survival', 'Sandbox', 'Visual Novel'
        ];
        
        for (const genre of genreKeywords) {
            if (new RegExp(`\\b${genre}\\b`, 'i').test(relevantText)) {
                categories.add(genre);
            }
        }
        
        // Default Steam features
        features.add('Steam Cloud');
        if (categories.has('Shooter') || categories.has('Action')) {
            features.add('Multiplayer');
        } else {
            features.add('Single-player');
        }
        
    } catch (error) {
        console.error(`Error searching Google: ${error.message}`);
    }
    
    return { categories: Array.from(categories), features: Array.from(features) };
}

// ========== ENHANCED STEAM SCRAPERS ==========

// 1. STEAM FREE GAMES (Free to Play and $0.00 games)
export const scrapeSteamFreeGames = async () => {
    const driver = await createDriver();
    const url = "https://store.steampowered.com/search/?sort_by=Price_ASC&supportedlang=english&maxprice=free";
    const gameData = [];
    const processedTitles = new Set();

    try {
        console.log("\n=== Scraping STEAM FREE GAMES ===");
        await driver.get(url);
        await driver.sleep(5000);

        let previousHeight = 0;
        let noNewContentCount = 0;
        const MAX_RETRIES = 3;
        let totalProcessed = 0;

        while (noNewContentCount < MAX_RETRIES && totalProcessed < 100) { // Limit to 100 games
            const gameElements = await driver.findElements(By.className("search_result_row"));
            
            for (const game of gameElements) {
                if (totalProcessed >= 100) break;
                
                try {
                    await driver.executeScript("arguments[0].scrollIntoView();", game);
                    
                    const title = await game.findElement(By.className("title")).getText();
                    if (processedTitles.has(title)) continue;
                    
                    const releaseDate = await game.findElement(By.className("search_released")).getText();
                    const link = await game.getAttribute("href");
                    
                    let price = "Free";
                    let isFree = false;
                    
                    try {
                        const priceElement = await game.findElement(By.css(".discount_final_price, .search_price"));
                        price = await priceElement.getText();
                        // Check if it's actually free
                        if (price.toLowerCase().includes('free') || price === '$0.00' || price === '0,00€') {
                            isFree = true;
                        }
                    } catch {
                        isFree = true; // If no price element, assume free
                    }
                    
                    if (!isFree) continue; // Skip non-free games
                    
                    console.log(`  Processing: ${title}`);
                    
                    // Open game page in new tab to get details
                    await driver.executeScript("window.open(arguments[0])", link);
                    const tabs = await driver.getAllWindowHandles();
                    await driver.switchTo().window(tabs[1]);
                    await driver.sleep(3000);
                    
                    // Get game image
                    let gameImage = "";
                    try {
                        const imageElement = await driver.findElement(By.css(".game_header_image_full, .game_header_image"));
                        gameImage = await imageElement.getAttribute("src");
                    } catch {
                        gameImage = "https://store.steampowered.com/favicon.ico";
                    }
                    
                    // Extract categories and features from Steam page
                    const { categories, features } = await extractSteamCategories(driver);
                    
                    // Close tab and switch back
                    await driver.close();
                    await driver.switchTo().window(tabs[0]);
                    
                    gameData.push({
                        title,
                        release_date: releaseDate,
                        available_until: "",
                        price: "Free",
                        image: gameImage,
                        link,
                        platform: "Steam",
                        tags: ["free-to-play"],
                        categories,
                        features
                    });
                    
                    processedTitles.add(title);
                    totalProcessed++;
                    console.log(`  ✓ ${title} - Categories: ${categories.length}, Features: ${features.length}`);
                    
                } catch (error) {
                    console.error(`  Error processing game: ${error.message}`);
                    // Ensure we're on the main tab
                    const tabs = await driver.getAllWindowHandles();
                    if (tabs.length > 1) {
                        await driver.close();
                        await driver.switchTo().window(tabs[0]);
                    }
                }
            }
            
            // Scroll to load more
            const currentHeight = await driver.executeScript("return document.documentElement.scrollHeight");
            await driver.executeScript("window.scrollTo(0, document.documentElement.scrollHeight);");
            await driver.sleep(2000);
            
            if (currentHeight === previousHeight) {
                noNewContentCount++;
            } else {
                noNewContentCount = 0;
            }
            previousHeight = currentHeight;
        }
        
        console.log(`\nFound ${gameData.length} free Steam games\n`);
        return gameData;
        
    } catch (error) {
        console.error(`Error scraping Steam free games: ${error.message}`);
        return [];
    } finally {
        await driver.quit();
    }
};

// 2. STEAM HIGHLY DISCOUNTED GAMES (90%+ off)
export const scrapeSteamHighlyDiscounted = async () => {
    const driver = await createDriver();
    const url = "https://store.steampowered.com/search/?sort_by=Price_ASC&supportedlang=english&specials=1";
    const gameData = [];
    const processedTitles = new Set();

    try {
        console.log("\n=== Scraping STEAM HIGHLY DISCOUNTED (90%+ off) ===");
        await driver.get(url);
        await driver.sleep(5000);
        
        let gamesChecked = 0;
        const maxGamesToCheck = 50;
        
        // Scroll to load games
        for (let i = 0; i < 3; i++) {
            await driver.executeScript("window.scrollTo(0, document.body.scrollHeight);");
            await driver.sleep(2000);
        }
        
        const gameElements = await driver.findElements(By.className("search_result_row"));
        console.log(`  Found ${gameElements.length} discounted games, filtering for 90%+ off...`);
        
        for (const game of gameElements) {
            if (gamesChecked >= maxGamesToCheck) break;
            gamesChecked++;
            
            try {
                const title = await game.findElement(By.className("title")).getText();
                if (processedTitles.has(title)) continue;
                
                // Check discount percentage
                let discountPercent = 0;
                try {
                    const discountElement = await game.findElement(By.css(".discount_pct, .search_discount span"));
                    const discountText = await discountElement.getText();
                    discountPercent = parseInt(discountText.replace(/[-%]/g, ''));
                } catch {
                    continue; // Skip if no discount
                }
                
                if (discountPercent < 90) continue; // Only 90%+ discounts
                
                const releaseDate = await game.findElement(By.className("search_released")).getText();
                const link = await game.getAttribute("href");
                
                // Get prices
                let currentPrice = "";
                let originalPrice = "";
                try {
                    const priceElement = await game.findElement(By.css(".discount_final_price"));
                    currentPrice = await priceElement.getText();
                    
                    const originalElement = await game.findElement(By.css(".discount_original_price"));
                    originalPrice = await originalElement.getText();
                } catch {}
                
                console.log(`  Found: ${title} (-${discountPercent}%)`);
                
                // Quick category extraction without opening new tab
                const gameTextContent = await game.getText();
                const quickCategories = [];
                
                const genreKeywords = ['Action', 'Adventure', 'RPG', 'Strategy', 'Simulation', 'Indie', 'Casual'];
                for (const genre of genreKeywords) {
                    if (gameTextContent.includes(genre)) {
                        quickCategories.push(genre);
                    }
                }
                
                gameData.push({
                    title,
                    release_date: releaseDate,
                    available_until: "Check Steam",
                    price: currentPrice,
                    original_price: originalPrice,
                    discount: `-${discountPercent}%`,
                    image: "",
                    link,
                    platform: "Steam",
                    tags: ["highly-discounted", `${discountPercent}%-off`],
                    categories: quickCategories,
                    features: ['Steam Cloud', 'Steam Achievements']
                });
                
                processedTitles.add(title);
                console.log(`  ✓ ${title} - Price: ${currentPrice} (was ${originalPrice})`);
                
            } catch (error) {
                console.error(`  Error processing discounted game: ${error.message}`);
            }
        }
        
        console.log(`\nFound ${gameData.length} games with 90%+ discount\n`);
        return gameData;
        
    } catch (error) {
        console.error(`Error scraping Steam discounts: ${error.message}`);
        return [];
    } finally {
        await driver.quit();
    }
};

// 3. STEAM TOP SELLERS UNDER $5
export const scrapeSteamBudgetGames = async () => {
    const driver = await createDriver();
    const url = "https://store.steampowered.com/search/?sort_by=_ASC&maxprice=500&supportedlang=english";
    const gameData = [];
    const processedTitles = new Set();
    
    try {
        console.log("\n=== Scraping STEAM BUDGET GAMES (Under $5) ===");
        await driver.get(url);
        await driver.sleep(5000);
        
        const gameElements = await driver.findElements(By.className("search_result_row"));
        const maxGames = Math.min(20, gameElements.length);
        
        for (let i = 0; i < maxGames; i++) {
            try {
                const game = gameElements[i];
                const title = await game.findElement(By.className("title")).getText();
                
                if (processedTitles.has(title)) continue;
                
                const releaseDate = await game.findElement(By.className("search_released")).getText();
                const link = await game.getAttribute("href");
                
                let price = "";
                try {
                    const priceElement = await game.findElement(By.css(".discount_final_price, .search_price"));
                    price = await priceElement.getText();
                } catch {}
                
                gameData.push({
                    title,
                    release_date: releaseDate,
                    price,
                    link,
                    platform: "Steam",
                    tags: ["budget", "under-5"],
                    categories: [],
                    features: ['Steam Cloud']
                });
                
                processedTitles.add(title);
                console.log(`  Found budget game: ${title} - ${price}`);
                
            } catch (error) {
                console.error(`  Error: ${error.message}`);
            }
        }
        
        console.log(`\nFound ${gameData.length} budget games under $5\n`);
        return gameData;
        
    } catch (error) {
        console.error(`Error scraping budget games: ${error.message}`);
        return [];
    } finally {
        await driver.quit();
    }
};

// 4. MAIN FUNCTION: Scrape ALL Steam Games
export const scrapeAllSteamGames = async () => {
    console.log("\n" + "=".repeat(60));
    console.log("STARTING COMPREHENSIVE STEAM SCRAPER");
    console.log("=".repeat(60));
    
    const allGames = {
        freeGames: [],
        highlyDiscounted: [],
        budgetGames: []
    };
    
    try {
        // 1. Scrape Free Games
        allGames.freeGames = await scrapeSteamFreeGames();
        
        // 2. Scrape Highly Discounted Games (90%+ off)
        allGames.highlyDiscounted = await scrapeSteamHighlyDiscounted();
        
        // 3. Scrape Budget Games (Under $5)
        allGames.budgetGames = await scrapeSteamBudgetGames();
        
        // Combine all games, avoiding duplicates
        const gameMap = new Map();
        
        [...allGames.freeGames, ...allGames.highlyDiscounted, ...allGames.budgetGames].forEach(game => {
            if (!gameMap.has(game.title)) {
                gameMap.set(game.title, game);
            } else {
                // Merge tags and categories
                const existing = gameMap.get(game.title);
                existing.tags = [...new Set([...existing.tags, ...game.tags])];
                existing.categories = [...new Set([...(existing.categories || []), ...(game.categories || [])])];
                existing.features = [...new Set([...(existing.features || []), ...(game.features || [])])];
            }
        });
        
        const finalGameData = Array.from(gameMap.values());
        
        // Print summary
        console.log("\n" + "=".repeat(60));
        console.log("STEAM SCRAPING COMPLETE - SUMMARY");
        console.log("=".repeat(60));
        console.log(`Free Games: ${allGames.freeGames.length} games`);
        console.log(`Highly Discounted (90%+): ${allGames.highlyDiscounted.length} games`);
        console.log(`Budget Games (Under $5): ${allGames.budgetGames.length} games`);
        console.log(`Total Unique Games: ${finalGameData.length} games`);
        
        // Category and Feature statistics
        const allCategories = new Set();
        const allFeatures = new Set();
        
        finalGameData.forEach(game => {
            game.categories?.forEach(cat => allCategories.add(cat));
            game.features?.forEach(feat => allFeatures.add(feat));
        });
        
        console.log(`\nUnique Categories: ${allCategories.size}`);
        if (allCategories.size > 0) {
            console.log(`Categories: ${Array.from(allCategories).slice(0, 20).join(", ")}${allCategories.size > 20 ? "..." : ""}`);
        }
        
        console.log(`\nUnique Features: ${allFeatures.size}`);
        if (allFeatures.size > 0) {
            console.log(`Features: ${Array.from(allFeatures).join(", ")}`);
        }
        
        console.log("=".repeat(60) + "\n");
        
        // Save to database
        if (finalGameData.length > 0) {
            await deleteAllGames("Steam");
            await addGames(
                { body: finalGameData },
                { status: (code) => ({ json: (message) => console.log(`Database saved: ${code}`, message) }) }
            );
        }
        
        return finalGameData;
        
    } catch (error) {
        console.error("Error in Steam main scraper:", error);
        return [];
    }
};

// Export all functions
export default {
    scrapeSteamFreeGames,
    scrapeSteamHighlyDiscounted,
    scrapeSteamBudgetGames,
    scrapeAllSteamGames
};