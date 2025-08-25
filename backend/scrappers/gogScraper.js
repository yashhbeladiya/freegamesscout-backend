import { By, until } from "selenium-webdriver";
import { createDriver, convertCountdownToDate } from "../utils/util.js";
import {
  addGames,
  deleteAllGames,
  deleteTopPicksPlatform,
} from "../controller/game.controller.js";

// ========== HELPER FUNCTIONS ==========

// Extract categories using Google search (same as Epic scraper)
async function extractCategoriesFromGoogle(driver, gameTitle) {
    const categories = new Set();
    const features = new Set();
    
    try {
        // Search Google for game + genre information
        const searchQuery = `${gameTitle} video game genre type steam gog metacritic`;
        const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
        
        console.log(`    Searching Google for: ${gameTitle}`);
        await driver.get(googleUrl);
        await driver.sleep(2000);
        
        // Get search result snippets (not the entire page)
        const searchResults = await driver.findElements(By.css('.g, .tF2Cxc, .IsZvec'));
        let relevantText = '';
        
        // Collect only the first few search result snippets
        for (let i = 0; i < Math.min(5, searchResults.length); i++) {
            try {
                const text = await searchResults[i].getText();
                relevantText += ' ' + text;
            } catch {}
        }
        
        // Also check for Google's knowledge panel if it exists
        try {
            const knowledgePanel = await driver.findElement(By.css('.kp-blk, .knowledge-panel'));
            const panelText = await knowledgePanel.getText();
            relevantText += ' ' + panelText;
        } catch {}
        
        // Common game genres to look for
        const genreKeywords = [
            'Action', 'Adventure', 'Arcade', 'Battle Royale',
            'Casual', 'City Builder', 'Exploration', 'Fantasy', 'Fighting',
            'Horror', 'Indie', 'Management', 'Mystery', 'Platform', 'Platformer',
            'Point and Click', 'Puzzle', 'Racing', 'RPG', 'Role-Playing',
            'Sandbox', 'Shooter', 'Simulation', 'Sports', 'Stealth', 'Strategy',
            'Survival', 'Tower Defense', 'Turn-Based', 'Tactical', 'Roguelike',
            'Metroidvania', 'Visual Novel', 'Walking Simulator', 'Sci-Fi'
        ];
        
        // Look for genre mentions NEAR the game title or in specific patterns
        for (const genre of genreKeywords) {
            // More specific patterns that indicate this genre is actually for this game
            const patterns = [
                new RegExp(`${gameTitle}.*?${genre}`, 'i'),  // Game title followed by genre
                new RegExp(`${genre}.*?${gameTitle}`, 'i'),  // Genre followed by game title
                new RegExp(`is an?\\s+${genre}`, 'i'),       // "is a/an [genre]"
                new RegExp(`${genre}\\s+(video\\s+)?game`, 'i'), // "[genre] game"
                new RegExp(`Genre[s]?:\\s*.*?${genre}`, 'i'),   // "Genre: [genre]"
                new RegExp(`Type[s]?:\\s*.*?${genre}`, 'i'),    // "Type: [genre]"
            ];
            
            for (const pattern of patterns) {
                if (pattern.test(relevantText)) {
                    categories.add(genre);
                    console.log(`      Found genre: ${genre}`);
                    break;
                }
            }
        }
        
        // Look for features
        const featureKeywords = [
            'Single-player', 'Single Player', 'Singleplayer',
            'Multiplayer', 'Multi-player', 'Online Multiplayer',
            'Co-op', 'Cooperative', 'Local Co-op',
            'Controller Support', 'Cloud Saves', 'Achievements',
            'DRM-Free', 'GOG Galaxy', 'Offline Play'
        ];
        
        for (const feature of featureKeywords) {
            if (relevantText.includes(feature)) {
                features.add(feature.replace(/[-\s]+/g, ' ').trim());
            }
        }
        
        // If still no categories found after Google search, use hardcoded database
        if (categories.size === 0) {
            console.log(`      No genres found on Google, using database...`);
            const gameLower = gameTitle.toLowerCase();
            const gameDatabase = {
                // Add common GOG games here
                'witcher': ['RPG', 'Fantasy', 'Action', 'Open World'],
                'cyberpunk': ['RPG', 'Sci-Fi', 'Action', 'Open World'],
                'baldur\'s gate': ['RPG', 'Fantasy', 'Turn-Based', 'Strategy'],
                'divinity': ['RPG', 'Fantasy', 'Turn-Based', 'Strategy'],
                'hollow knight': ['Metroidvania', 'Platform', 'Indie', 'Action'],
                'stardew valley': ['Simulation', 'Farming', 'Indie', 'Casual'],
                'terraria': ['Sandbox', 'Adventure', 'Survival', 'Indie'],
                'disco elysium': ['RPG', 'Detective', 'Mystery', 'Narrative'],
                'hades': ['Roguelike', 'Action', 'Indie', 'Mythology'],
                'celeste': ['Platform', 'Indie', 'Pixel Art'],
                'dead cells': ['Roguelike', 'Metroidvania', 'Action', 'Indie'],
                'darkest dungeon': ['RPG', 'Roguelike', 'Strategy', 'Turn-Based'],
                'frostpunk': ['Strategy', 'Survival', 'City Builder'],
                'this war of mine': ['Survival', 'Strategy', 'War'],
                'papers please': ['Simulation', 'Indie', 'Dystopian'],
                'return of the obra dinn': ['Mystery', 'Puzzle', 'Investigation'],
                'outer wilds': ['Exploration', 'Space', 'Mystery', 'Puzzle']
            };
            
            // Try to find a match in the database
            for (const [game, genres] of Object.entries(gameDatabase)) {
                if (gameLower.includes(game) || game.includes(gameLower)) {
                    genres.forEach(g => categories.add(g));
                    console.log(`      Using database genres: ${genres.join(', ')}`);
                    break;
                }
            }
        }
        
        // Add default GOG features if none found
        if (features.size === 0) {
            features.add('DRM-Free'); // All GOG games are DRM-free
            features.add('Offline Play');
            if (categories.has('RPG') || categories.has('Adventure') || 
                categories.has('Puzzle') || categories.has('Strategy')) {
                features.add('Single Player');
            }
            if (categories.has('Shooter') || categories.has('Battle Royale')) {
                features.add('Multiplayer');
            }
        }
        
    } catch (error) {
        console.error(`    Error searching Google: ${error.message}`);
    }
    
    return { 
        categories: Array.from(categories), 
        features: Array.from(features) 
    };
}

// ========== ENHANCED GOG SCRAPERS ==========

// 1. GOG GIVEAWAY (Limited Time Free Games)
export const scrapeGOGGiveaway = async () => {
    const driver = await createDriver();

    try {
        console.log("\n=== Scraping GOG GIVEAWAY (Limited Time Free) ===");
        const url = "https://www.gog.com/en/";
        await driver.get(url);

        const gameData = [];

        // Check if there's an active giveaway (GOG doesn't always have one)
        try {
            // Wait for the giveaway section to load (shorter timeout)
            const giveawayHeader = await driver.wait(
                until.elementLocated(By.css(".giveaway__content-header")),
                10000 // Reduced timeout to 10 seconds
            );

            // Extract the game name
            const gameName = (await giveawayHeader.getText()).split(":")[1].trim();
            console.log(`  Found giveaway: ${gameName}`);

            // Extract the game link
            const gameLink = await driver
                .findElement(By.css("a.giveaway__overlay-link"))
                .getAttribute("href");

            // Extract the availability
            const availability = await driver
                .findElement(By.css(".giveaway__countdown"))
                .getText();
            const availableUntil = await convertCountdownToDate(availability);

            // Extract the image link from <source> inside <picture>
            const imageSources = await driver.findElements(
                By.css("picture.giveaway__image source")
            );
            let imageLink = null;

            for (const source of imageSources) {
                const srcset = await source.getAttribute("srcset");
                if (srcset) {
                    imageLink = srcset.split(",")[0].trim();
                    break;
                }
            }

            // Get categories and features using Google search
            console.log(`  Fetching categories for: ${gameName}`);
            const { categories, features } = await extractCategoriesFromGoogle(driver, gameName);

            // Store the game data with categories and features
            gameData.push({
                title: gameName,
                release_date: new Date().toLocaleDateString(),
                available_until: availableUntil,
                price: "Free",
                image: imageLink,
                link: gameLink,
                platform: "GOG",
                tags: ["top-pick", "giveaway", "limited-time"],
                categories,
                features
            });

            console.log(`  ✓ ${gameName} - Categories: ${categories.length}, Features: ${features.length}`);
            
        } catch (error) {
            console.log("  No active giveaway found on GOG homepage");
            
            // Alternative: Check GOG's giveaway page directly
            try {
                console.log("  Checking alternative giveaway URL...");
                await driver.get("https://www.gog.com/giveaway");
                await driver.sleep(2000);
                
                // Try to find giveaway on this page
                const giveawayTitle = await driver.findElement(By.css("h1, .giveaway-banner__title, .header__title")).catch(() => null);
                
                if (giveawayTitle) {
                    const gameName = await giveawayTitle.getText();
                    if (gameName && !gameName.toLowerCase().includes("no giveaway")) {
                        console.log(`  Found giveaway on alternative page: ${gameName}`);
                        
                        // Get categories
                        const { categories, features } = await extractCategoriesFromGoogle(driver, gameName);
                        
                        gameData.push({
                            title: gameName,
                            release_date: new Date().toLocaleDateString(),
                            available_until: "Check GOG",
                            price: "Free",
                            image: "",
                            link: "https://www.gog.com/giveaway",
                            platform: "GOG",
                            tags: ["top-pick", "giveaway", "limited-time"],
                            categories,
                            features
                        });
                        
                        console.log(`  ✓ ${gameName} - Categories: ${categories.length}, Features: ${features.length}`);
                    }
                }
            } catch {
                console.log("  No giveaway found on alternative URL either");
            }
        }

        if (gameData.length === 0) {
            console.log("  No GOG giveaways currently active\n");
        } else {
            console.log(`Found ${gameData.length} giveaway game(s)\n`);
            await deleteTopPicksPlatform("GOG");
        }

        // Add the game data to the database if any found
        if (gameData.length > 0) {
            await addGames(
                { body: gameData },
                {
                    status: (code) => ({
                        json: (message) => console.log(`Status ${code}:`, message),
                    }),
                }
            );
        }

        return gameData;
    } catch (error) {
        console.error("Error scraping GOG Giveaway:", error.message);
        return [];
    } finally {
        await driver.quit();
    }
};

// 2. GOG FREE GAMES (Always Free)
export const scrapeGOGFreeGames = async () => {
    const driver = await createDriver();

    try {
        console.log("\n=== Scraping GOG FREE GAMES (Always Free) ===");
        const url = "https://www.gog.com/en/games?priceRange=0,0&hideDLCs=true";
        await driver.get(url);

        const gameDataRaw = [];
        let hasNextPage = true;
        let pageNum = 1;

        while (hasNextPage) {
            console.log(`  Scraping page ${pageNum}...`);
            
            // Wait for the game elements to load
            await driver.wait(until.elementsLocated(By.css("a.product-tile")), 30000);
            const freeGames = await driver.findElements(By.css("a.product-tile"));

            // Scrape games on the current page
            for (const game of freeGames) {
                try {
                    const title = await game
                        .findElement(By.css('[selenium-id="productTileGameTitle"]'))
                        .getText();
                    const link = await game.getAttribute("href");

                    const imageElement = await game
                        .findElement(By.css('source[type="image/webp"]'))
                        .catch(() => null);

                    let image = null;

                    if (imageElement) {
                        const srcset = await imageElement.getAttribute("srcset").catch(() => null);
                        if (srcset) {
                            const urls = srcset.split(",");
                            image = urls[0].trim();
                        }
                    }

                    if (!image) {
                        // Try scrolling and waiting for image to load
                        await driver.executeScript("arguments[0].scrollIntoView();", game);
                        await driver.sleep(1000);
                        const imageElement2 = await game.findElement(By.css('source[type="image/webp"]'));
                        const srcset2 = await imageElement2.getAttribute("srcset").catch(() => null);
                        if (srcset2) {
                            const urls = srcset2.split(",");
                            image = urls[0].trim();
                        }
                    }

                    if (!/demo/i.test(title)) {
                        gameDataRaw.push({
                            title,
                            price: "Free",
                            image,
                            link,
                            platform: "GOG",
                            tags: ["always-free", "drm-free"]
                        });
                        console.log(`    Found: ${title}`);
                    }
                } catch (error) {
                    console.error(`    Error processing game: ${error.message}`);
                    break;
                }
            }

            // Check if the "Next" button is enabled
            const nextButton = await driver.findElement(
                By.css('[selenium-id="paginationNext"]')
            );
            const nextButtonClass = await nextButton.getAttribute("class");

            if (nextButtonClass && !nextButtonClass.includes("disabled")) {
                await driver.executeScript("window.scrollTo(0, document.body.scrollHeight);");
                await driver.sleep(1000);
                await driver.executeScript("arguments[0].click();", nextButton);
                await driver.sleep(2000);
                pageNum++;
            } else {
                hasNextPage = false;
            }
        }

        console.log(`\n  Fetching categories for ${gameDataRaw.length} games...`);
        
        // Get categories for each game using Google search
        const gameData = [];
        for (const game of gameDataRaw) {
            console.log(`  Fetching categories for: ${game.title}`);
            const { categories, features } = await extractCategoriesFromGoogle(driver, game.title);
            
            gameData.push({
                ...game,
                categories,
                features
            });
            
            console.log(`  ✓ ${game.title} - Categories: ${categories.length}, Features: ${features.length}`);
        }

        console.log(`\nFound ${gameData.length} free GOG games\n`);

        // Save the game data to the database
        if (gameData.length > 0) {
            await deleteAllGames("GOG");
            await addGames(
                { body: gameData },
                {
                    status: (code) => ({
                        json: (message) => console.log(`Status ${code}:`, message),
                    }),
                }
            );
        }

        return gameData;
    } catch (error) {
        console.error("Error scraping GOG free games:", error.message);
        return [];
    } finally {
        await driver.quit();
    }
};

// 3. GOG DISCOUNTED GAMES (75%+ off)
export const scrapeGOGHighlyDiscounted = async () => {
    const driver = await createDriver();

    try {
        console.log("\n=== Scraping GOG HIGHLY DISCOUNTED (75%+ off) ===");
        const url = "https://www.gog.com/en/games?discounted=true&order=desc:discount";
        await driver.get(url);
        await driver.sleep(3000);

        const gameData = [];
        let gamesChecked = 0;
        const maxGamesToCheck = 100; // Limit to avoid checking too many games

        // Scroll to load more games
        for (let i = 0; i < 3; i++) {
            await driver.executeScript("window.scrollTo(0, document.body.scrollHeight);");
            await driver.sleep(2000);
        }

        const gameCards = await driver.findElements(By.css("a.product-tile"));
        console.log(`  Found ${gameCards.length} discounted games, filtering for 75%+ off...`);

        for (const card of gameCards) {
            if (gamesChecked >= maxGamesToCheck) break;
            gamesChecked++;

            try {
                // Look for discount percentage
                const discountElement = await card.findElement(By.css(".product-tile__discount")).catch(() => null);
                
                if (discountElement) {
                    const discountText = await discountElement.getText();
                    const discountPercent = parseInt(discountText.replace(/[-%]/g, ''));
                    
                    if (discountPercent >= 75) {
                        const title = await card
                            .findElement(By.css('[selenium-id="productTileGameTitle"]'))
                            .getText();
                        
                        const link = await card.getAttribute("href");
                        
                        // Get current price
                        const priceElement = await card.findElement(By.css(".product-tile__price-discounted"));
                        const currentPrice = await priceElement.getText();
                        
                        // Get image
                        let image = null;
                        const imageElement = await card.findElement(By.css('source[type="image/webp"]')).catch(() => null);
                        if (imageElement) {
                            const srcset = await imageElement.getAttribute("srcset").catch(() => null);
                            if (srcset) {
                                image = srcset.split(",")[0].trim();
                            }
                        }

                        console.log(`    Found: ${title} (-${discountPercent}%)`);
                        
                        // Get categories using Google
                        const { categories, features } = await extractCategoriesFromGoogle(driver, title);
                        
                        gameData.push({
                            title,
                            price: currentPrice,
                            discount: `-${discountPercent}%`,
                            image,
                            link,
                            platform: "GOG",
                            tags: ["highly-discounted", `${discountPercent}%-off`, "drm-free"],
                            categories,
                            features
                        });
                        
                        console.log(`    ✓ ${title} - Price: ${currentPrice} - Categories: ${categories.length}, Features: ${features.length}`);
                    }
                }
            } catch (error) {
                // Skip games without proper discount info
            }
        }

        console.log(`\nFound ${gameData.length} games with 75%+ discount\n`);
        return gameData;

    } catch (error) {
        console.error("Error scraping GOG discounted games:", error.message);
        return [];
    } finally {
        await driver.quit();
    }
};

// 4. MAIN FUNCTION: Scrape ALL GOG Games
export const scrapeAllGOGGames = async () => {
    console.log("\n" + "=".repeat(60));
    console.log("STARTING COMPREHENSIVE GOG SCRAPER");
    console.log("=".repeat(60));
    
    const allGames = {
        giveaway: [],
        alwaysFree: [],
        highlyDiscounted: []
    };
    
    try {
        // 1. Scrape Giveaway (Limited Time Free)
        allGames.giveaway = await scrapeGOGGiveaway();
        
        // 2. Scrape Always Free Games
        allGames.alwaysFree = await scrapeGOGFreeGames();
        
        // 3. Scrape Highly Discounted Games
        allGames.highlyDiscounted = await scrapeGOGHighlyDiscounted();
        
        // Combine all games, avoiding duplicates
        const gameMap = new Map();
        
        [...allGames.giveaway, ...allGames.alwaysFree, ...allGames.highlyDiscounted].forEach(game => {
            if (!gameMap.has(game.title)) {
                gameMap.set(game.title, game);
            } else {
                // Merge tags, categories, and features if duplicate found
                const existing = gameMap.get(game.title);
                existing.tags = [...new Set([...existing.tags, ...game.tags])];
                existing.categories = [...new Set([...(existing.categories || []), ...(game.categories || [])])];
                existing.features = [...new Set([...(existing.features || []), ...(game.features || [])])];
            }
        });
        
        const finalGameData = Array.from(gameMap.values());
        
        // Print summary
        console.log("\n" + "=".repeat(60));
        console.log("GOG SCRAPING COMPLETE - SUMMARY");
        console.log("=".repeat(60));
        console.log(`Giveaway (Limited Free): ${allGames.giveaway.length} games`);
        console.log(`Always Free: ${allGames.alwaysFree.length} games`);
        console.log(`Highly Discounted (75%+): ${allGames.highlyDiscounted.length} games`);
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
            console.log(`Categories: ${Array.from(allCategories).slice(0, 15).join(", ")}${allCategories.size > 15 ? "..." : ""}`);
        }
        
        console.log(`\nUnique Features: ${allFeatures.size}`);
        if (allFeatures.size > 0) {
            console.log(`Features: ${Array.from(allFeatures).join(", ")}`);
        }
        
        console.log("=".repeat(60) + "\n");
        
        return finalGameData;
        
    } catch (error) {
        console.error("Error in GOG main scraper:", error);
        return [];
    }
};

// Export all functions
export default {
    scrapeGOGGiveaway,
    scrapeGOGFreeGames,
    scrapeGOGHighlyDiscounted,
    scrapeAllGOGGames
};