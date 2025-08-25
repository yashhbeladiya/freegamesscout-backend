import { By, until } from "selenium-webdriver";
import { createDriver } from "../utils/util.js";
import { addGames, deleteAllGames } from "../controller/game.controller.js";

// ========== HELPER FUNCTIONS ==========

// Extract categories using Google search (same approach as Epic/GOG)
async function extractCategoriesFromGoogle(driver, gameTitle) {
    const categories = new Set();
    const features = new Set();
    
    try {
        // Search Google for game + genre information
        const searchQuery = `${gameTitle} video game genre type steam prime gaming metacritic`;
        const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
        
        console.log(`    Searching Google for: ${gameTitle}`);
        await driver.get(googleUrl);
        await driver.sleep(2000);
        
        // Get search result snippets
        const searchResults = await driver.findElements(By.css('.g, .tF2Cxc, .IsZvec'));
        let relevantText = '';
        
        for (let i = 0; i < Math.min(5, searchResults.length); i++) {
            try {
                const text = await searchResults[i].getText();
                relevantText += ' ' + text;
            } catch {}
        }
        
        // Check for Google's knowledge panel
        try {
            const knowledgePanel = await driver.findElement(By.css('.kp-blk, .knowledge-panel'));
            const panelText = await knowledgePanel.getText();
            relevantText += ' ' + panelText;
        } catch {}
        
        // Common game genres
        const genreKeywords = [
            'Action', 'Adventure', 'Arcade', 'Battle Royale',
            'Casual', 'City Builder', 'Exploration', 'Fantasy', 'Fighting',
            'Horror', 'Indie', 'Management', 'Mystery', 'Platform', 'Platformer',
            'Point and Click', 'Puzzle', 'Racing', 'RPG', 'Role-Playing',
            'Sandbox', 'Shooter', 'Simulation', 'Sports', 'Stealth', 'Strategy',
            'Survival', 'Tower Defense', 'Turn-Based', 'Tactical', 'Roguelike',
            'Metroidvania', 'Visual Novel', 'Walking Simulator', 'Sci-Fi', 'Space',
            'Retro', 'Pixel Art', 'JRPG', 'Hack and Slash', 'Beat \'em up'
        ];
        
        // Look for genre mentions near the game title
        for (const genre of genreKeywords) {
            const patterns = [
                new RegExp(`${gameTitle}.*?${genre}`, 'i'),
                new RegExp(`${genre}.*?${gameTitle}`, 'i'),
                new RegExp(`is an?\\s+${genre}`, 'i'),
                new RegExp(`${genre}\\s+(video\\s+)?game`, 'i'),
                new RegExp(`Genre[s]?:\\s*.*?${genre}`, 'i'),
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
            'Co-op', 'Cooperative', 'Local Co-op', 'PvP', 'PvE',
            'Controller Support', 'Cloud Saves', 'Achievements',
            'Cross-Platform', 'Steam Deck Verified'
        ];
        
        for (const feature of featureKeywords) {
            if (relevantText.includes(feature)) {
                features.add(feature.replace(/[-\s]+/g, ' ').trim());
            }
        }
        
        // If no categories found, use database
        if (categories.size === 0) {
            console.log(`      No genres found on Google, using database...`);
            const gameLower = gameTitle.toLowerCase();
            const gameDatabase = {
                // Popular Prime Gaming titles
                'fallout': ['RPG', 'Post-Apocalyptic', 'Action', 'Open World'],
                'tomb raider': ['Action', 'Adventure', 'Puzzle', 'Platform'],
                'mass effect': ['RPG', 'Sci-Fi', 'Action', 'Space'],
                'star wars': ['Action', 'Adventure', 'Sci-Fi', 'Space'],
                'batman': ['Action', 'Adventure', 'Stealth', 'Superhero'],
                'assassin': ['Action', 'Adventure', 'Stealth', 'Open World'],
                'borderlands': ['Shooter', 'RPG', 'Looter', 'Co-op'],
                'bioshock': ['Shooter', 'RPG', 'Horror', 'Sci-Fi'],
                'dishonored': ['Stealth', 'Action', 'Immersive Sim'],
                'control': ['Action', 'Adventure', 'Supernatural', 'Mystery'],
                'middle-earth': ['Action', 'RPG', 'Fantasy', 'Open World'],
                'need for speed': ['Racing', 'Arcade', 'Action'],
                'football manager': ['Sports', 'Simulation', 'Management'],
                'total war': ['Strategy', 'Turn-Based', 'Real-Time Strategy'],
                'ghostwire': ['Action', 'Horror', 'Supernatural'],
                'blasphemous': ['Metroidvania', 'Platform', 'Souls-like'],
                'dead space': ['Horror', 'Survival', 'Sci-Fi', 'Action'],
                'yakuza': ['Action', 'Adventure', 'Beat \'em up', 'Crime'],
                'far cry': ['Shooter', 'Open World', 'Action', 'Adventure'],
                'doom': ['Shooter', 'Action', 'Horror', 'Sci-Fi'],
                'wolfenstein': ['Shooter', 'Action', 'Alternative History'],
                'metro': ['Shooter', 'Survival', 'Horror', 'Post-Apocalyptic'],
                'saints row': ['Action', 'Open World', 'Comedy', 'Crime'],
                'mafia': ['Action', 'Crime', 'Open World', 'Story'],
                'two point': ['Simulation', 'Management', 'Comedy', 'Casual']
            };
            
            for (const [game, genres] of Object.entries(gameDatabase)) {
                if (gameLower.includes(game) || game.includes(gameLower)) {
                    genres.forEach(g => categories.add(g));
                    console.log(`      Using database genres: ${genres.join(', ')}`);
                    break;
                }
            }
        }
        
        // Add default features for Prime Gaming
        if (features.size === 0) {
            features.add('Prime Exclusive');
            features.add('Cloud Saves');
            if (categories.has('RPG') || categories.has('Adventure') || 
                categories.has('Puzzle') || categories.has('Strategy')) {
                features.add('Single Player');
            }
            if (categories.has('Shooter') || categories.has('Battle Royale') || 
                categories.has('Sports') || categories.has('Racing')) {
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

// ========== ENHANCED PRIME GAMING SCRAPERS ==========

// 1. PRIME FREE GAMES (Main scraper for all free games)
export const scrapePrimeGames = async () => {
    const driver = await createDriver();

    try {
        console.log("\n=== Scraping PRIME GAMING FREE GAMES ===");
        const url = "https://gaming.amazon.com/home";
        
        await driver.get(url);
        console.log("  Waiting for page to load...");
        await driver.sleep(10000);

        // Wait for game cards to load
        const gameCards = await driver.wait(
            until.elementsLocated(By.className("item-card__action")),
            30000
        );

        console.log(`  Found ${gameCards.length} game cards`);

        const gameDataRaw = [];

        // First pass: collect basic game data
        for (let i = 0; i < gameCards.length; i++) {
            try {
                const card = gameCards[i];
                
                // Scroll the card into view
                await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", card);
                await driver.sleep(500);
                
                // Extract game title
                let title = "";
                try {
                    const titleElement = await card.findElement(By.css("h3, .item-card__title, [class*='title']"));
                    title = await titleElement.getText();
                } catch {
                    console.log(`    Card ${i}: Could not find title`);
                    continue;
                }

                // More comprehensive free game detection
                let isFree = false;
                let gameType = "unknown";
                
                // Method 1: Check for free game label
                try {
                    const labels = await card.findElements(By.css("p, span, [class*='label'], [class*='tag']"));
                    for (const label of labels) {
                        const labelText = await label.getText();
                        const labelTitle = await label.getAttribute("title");
                        
                        if (labelText || labelTitle) {
                            const combinedText = `${labelText} ${labelTitle}`.toLowerCase();
                            
                            if (combinedText.includes('free game') || 
                                combinedText.includes('free with prime') ||
                                combinedText.includes('included with prime')) {
                                isFree = true;
                                gameType = "free-game";
                                break;
                            } else if (combinedText.includes('in-game') || 
                                      combinedText.includes('loot') ||
                                      combinedText.includes('content')) {
                                gameType = "in-game-content";
                            }
                        }
                    }
                } catch {}
                
                // Method 2: Check card text content
                if (!isFree && gameType === "unknown") {
                    try {
                        const cardText = await card.getText();
                        const cardTextLower = cardText.toLowerCase();
                        
                        if (cardTextLower.includes('get game') || 
                            cardTextLower.includes('play with prime') ||
                            cardTextLower.includes('claim game')) {
                            isFree = true;
                            gameType = "free-game";
                        } else if (cardTextLower.includes('get in-game content') ||
                                  cardTextLower.includes('claim loot')) {
                            gameType = "in-game-content";
                        }
                    } catch {}
                }
                
                // Method 3: Check for specific Prime Gaming indicators
                if (!isFree && gameType === "unknown") {
                    try {
                        // Look for claim button or similar
                        const claimButton = await card.findElement(By.css("[class*='claim'], button"));
                        const buttonText = await claimButton.getText();
                        if (buttonText.toLowerCase().includes('claim') || 
                            buttonText.toLowerCase().includes('get')) {
                            isFree = true;
                            gameType = "free-game";
                        }
                    } catch {}
                }
                
                // Method 4: If we have a title but couldn't determine type, include it anyway
                // Prime Gaming page usually only shows claimable content
                if (title && gameType === "unknown") {
                    isFree = true;
                    gameType = "free-game";
                    console.log(`    Including ${title} (couldn't determine type, assuming free game)`);
                }

                if (isFree && gameType === "free-game") {
                    // Extract game image
                    let imgUrl = "";
                    try {
                        const imgElements = await card.findElements(By.css("img"));
                        for (const img of imgElements) {
                            const src = await img.getAttribute("src");
                            if (src && !src.includes('placeholder') && !src.includes('blank')) {
                                imgUrl = src;
                                break;
                            }
                        }
                    } catch {}

                    // Extract link to the game
                    let gameLink = "";
                    try {
                        const linkElement = await card.findElement(By.css("a"));
                        gameLink = await linkElement.getAttribute("href");
                        // Make sure it's a full URL
                        if (gameLink && !gameLink.startsWith('http')) {
                            gameLink = `https://gaming.amazon.com${gameLink}`;
                        }
                    } catch {}

                    // Check if it's a limited-time offer
                    let isLimitedTime = false;
                    try {
                        const timerElements = await card.findElements(By.css("[class*='countdown'], [class*='timer'], [class*='expire'], [class*='ends']"));
                        if (timerElements.length > 0) {
                            isLimitedTime = true;
                        }
                    } catch {}

                    gameDataRaw.push({
                        title,
                        price: "Free with Prime",
                        image: imgUrl,
                        link: gameLink,
                        platform: "Prime Gaming",
                        tags: isLimitedTime ? ["prime-exclusive", "limited-time"] : ["prime-exclusive"]
                    });

                    console.log(`    Found: ${title}${isLimitedTime ? ' (Limited Time)' : ''}`);
                }
            } catch (error) {
                console.error(`    Error processing card ${i}: ${error.message}`);
            }
        }

        console.log(`\n  Found ${gameDataRaw.length} free games out of ${gameCards.length} cards`);
        
        if (gameDataRaw.length === 0) {
            console.log("  No free games identified. Trying alternative approach...");
            
            // Alternative: Get ALL game cards and filter later
            try {
                const allCards = await driver.findElements(By.css(".item-card__action, [class*='game-card'], [class*='offer-card']"));
                console.log(`  Found ${allCards.length} cards with alternative selectors`);
                
                for (const card of allCards.slice(0, 10)) { // Test first 10
                    try {
                        const title = await card.getText();
                        if (title && title.length > 0) {
                            console.log(`    Card text: ${title.substring(0, 50)}...`);
                        }
                    } catch {}
                }
            } catch {}
        }

        console.log(`\n  Fetching categories for ${gameDataRaw.length} games...`);

        // Second pass: get categories for each game
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

        console.log(`\nFound ${gameData.length} Prime Gaming free games\n`);

        // Save to database
        if (gameData.length > 0) {
            await deleteAllGames("Prime Gaming");
            await addGames({ body: gameData }, { 
                status: (code) => ({ json: (message) => console.log(`Database saved: ${code}`, message) })
            });
        }

        return gameData;
    } catch (error) {
        console.error("Error scraping Prime Gaming:", error.message);
        return [];
    } finally {
        await driver.quit();
    }
};

// 2. PRIME IN-GAME CONTENT (Separate scraper for DLC/in-game items)
export const scrapePrimeInGameContent = async () => {
    const driver = await createDriver();

    try {
        console.log("\n=== Scraping PRIME GAMING IN-GAME CONTENT ===");
        const url = "https://gaming.amazon.com/home";
        
        await driver.get(url);
        await driver.sleep(10000);

        const gameCards = await driver.wait(
            until.elementsLocated(By.className("item-card__action")),
            30000
        );

        const contentData = [];

        for (const card of gameCards) {
            try {
                const titleElement = await card.findElement(By.css("h3"));
                const title = await titleElement.getText();

                // Check for "In-Game Content" or "Loot" label
                let isInGameContent = false;
                try {
                    const contentLabel = await card.findElement(
                        By.xpath(".//p[contains(@title, 'in-game') or contains(@title, 'loot') or contains(@title, 'content')]")
                    );
                    if (contentLabel) {
                        isInGameContent = true;
                    }
                } catch {
                    // Check text content
                    const cardText = await card.getText();
                    if (cardText.toLowerCase().includes('in-game') || 
                        cardText.toLowerCase().includes('loot') ||
                        cardText.toLowerCase().includes('content')) {
                        isInGameContent = true;
                    }
                }

                if (isInGameContent) {
                    let imgUrl = "";
                    try {
                        const imgElement = await card.findElement(By.css("img"));
                        imgUrl = await imgElement.getAttribute("src");
                    } catch {}

                    let gameLink = "";
                    try {
                        const linkElement = await card.findElement(By.tagName("a"));
                        gameLink = await linkElement.getAttribute("href");
                        if (gameLink && !gameLink.startsWith('http')) {
                            gameLink = `https://gaming.amazon.com${gameLink}`;
                        }
                    } catch {}

                    contentData.push({
                        title: `${title} - In-Game Content`,
                        price: "Free",
                        image: imgUrl,
                        link: gameLink,
                        platform: "Prime Gaming",
                        tags: ["in-game-content", "prime-loot"],
                        categories: ["DLC"],
                        features: ["Prime Exclusive"]
                    });

                    console.log(`    Found in-game content: ${title}`);
                }
            } catch (error) {
                console.error(`    Error processing content card: ${error.message}`);
            }
        }

        console.log(`\nFound ${contentData.length} in-game content items\n`);
        return contentData;
    } catch (error) {
        console.error("Error scraping Prime in-game content:", error.message);
        return [];
    } finally {
        await driver.quit();
    }
};

// 3. PRIME LUNA GAMES (Cloud gaming titles)
export const scrapePrimeLunaGames = async () => {
    const driver = await createDriver();

    try {
        console.log("\n=== Scraping PRIME LUNA CLOUD GAMES ===");
        const url = "https://luna.amazon.com/";
        
        await driver.get(url);
        await driver.sleep(5000);

        const gameData = [];

        // Try to find Luna game cards
        try {
            const lunaGames = await driver.findElements(By.css("[class*='game-card'], [class*='GameCard']"));
            
            for (const game of lunaGames) {
                try {
                    const title = await game.findElement(By.css("h2, h3, [class*='title']")).getText();
                    
                    let image = "";
                    try {
                        const imgEl = await game.findElement(By.css("img"));
                        image = await imgEl.getAttribute("src");
                    } catch {}

                    console.log(`    Found Luna game: ${title}`);
                    
                    // Get categories
                    const { categories, features } = await extractCategoriesFromGoogle(driver, title);
                    
                    gameData.push({
                        title,
                        price: "Free with Luna+",
                        image,
                        link: "https://luna.amazon.com/",
                        platform: "Prime Gaming",
                        tags: ["luna", "cloud-gaming", "streaming"],
                        categories,
                        features: [...features, "Cloud Gaming", "Instant Play"]
                    });
                    
                    console.log(`    ✓ ${title} - Categories: ${categories.length}`);
                } catch {}
            }
        } catch {
            console.log("    No Luna games found or Luna not available in region");
        }

        console.log(`\nFound ${gameData.length} Luna cloud games\n`);
        return gameData;
    } catch (error) {
        console.error("Error scraping Luna games:", error.message);
        return [];
    } finally {
        await driver.quit();
    }
};

// 4. MAIN FUNCTION: Scrape ALL Prime Gaming Content
export const scrapeAllPrimeGaming = async () => {
    console.log("\n" + "=".repeat(60));
    console.log("STARTING COMPREHENSIVE PRIME GAMING SCRAPER");
    console.log("=".repeat(60));
    
    const allContent = {
        freeGames: [],
        inGameContent: [],
        lunaGames: []
    };
    
    try {
        // 1. Scrape Free Games
        allContent.freeGames = await scrapePrimeGames();
        
        // 2. Scrape In-Game Content (optional - these aren't full games)
        // Uncomment if you want to include DLC/loot
        // allContent.inGameContent = await scrapePrimeInGameContent();
        
        // 3. Scrape Luna Cloud Games (optional - requires different subscription)
        // Uncomment if you want Luna games
        // allContent.lunaGames = await scrapePrimeLunaGames();
        
        // Combine all games, avoiding duplicates
        const gameMap = new Map();
        
        [...allContent.freeGames, ...allContent.inGameContent, ...allContent.lunaGames].forEach(game => {
            if (!gameMap.has(game.title)) {
                gameMap.set(game.title, game);
            } else {
                // Merge tags and categories if duplicate
                const existing = gameMap.get(game.title);
                existing.tags = [...new Set([...existing.tags, ...game.tags])];
                existing.categories = [...new Set([...(existing.categories || []), ...(game.categories || [])])];
                existing.features = [...new Set([...(existing.features || []), ...(game.features || [])])];
            }
        });
        
        const finalGameData = Array.from(gameMap.values());
        
        // Print summary
        console.log("\n" + "=".repeat(60));
        console.log("PRIME GAMING SCRAPING COMPLETE - SUMMARY");
        console.log("=".repeat(60));
        console.log(`Free Games: ${allContent.freeGames.length} games`);
        console.log(`In-Game Content: ${allContent.inGameContent.length} items`);
        console.log(`Luna Cloud Games: ${allContent.lunaGames.length} games`);
        console.log(`Total Unique Items: ${finalGameData.length}`);
        
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
        console.error("Error in Prime Gaming main scraper:", error);
        return [];
    }
};

// Export all functions
export default {
    scrapePrimeGames,           // Main free games scraper
    scrapePrimeInGameContent,   // In-game content/DLC scraper
    scrapePrimeLunaGames,       // Luna cloud games scraper
    scrapeAllPrimeGaming        // Combined scraper
};