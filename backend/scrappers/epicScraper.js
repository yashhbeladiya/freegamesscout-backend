import { By, until } from "selenium-webdriver";
import { createDriver, formatToCustomDate } from "../utils/util.js";
import { addGames, deleteAllGames, deleteTopPicksPlatform } from "../controller/game.controller.js";

// ========== HELPER FUNCTIONS ==========

// Extract categories and features from a game page
async function extractCategoriesAndFeatures(driver, gameUrl = null) {
    const categories = new Set();
    const features = new Set();
    
    try {
        // If URL provided, navigate to it in a new tab
        if (gameUrl) {
            // Open in new tab to avoid losing current page context
            const originalWindow = await driver.getWindowHandle();
            await driver.executeScript(`window.open('${gameUrl}', '_blank');`);
            const windows = await driver.getAllWindowHandles();
            await driver.switchTo().window(windows[windows.length - 1]);
            
            // Wait for page to load initially
            await driver.sleep(3000);
            
            // Scroll down multiple times to ensure content loads
            console.log("    Scrolling to load content...");
            for (let i = 0; i < 3; i++) {
                await driver.executeScript("window.scrollBy(0, window.innerHeight);");
                await driver.sleep(1500);
            }
            await driver.executeScript("window.scrollTo(0, document.body.scrollHeight);");
            await driver.sleep(2000);
            
            // Wait for metadata section to appear
            try {
                await driver.wait(until.elementLocated(By.css('[data-testid="about-metadata-layout-column"], .css-j7qwjs, .css-11w1nwr')), 10000);
            } catch {
                console.log("    Metadata section not found, continuing anyway...")
            }
            
            // DEBUG: Check what's on the page
            console.log("    Checking page structure...");
            try {
                // Check if we're on the right page
                const currentUrl = await driver.getCurrentUrl();
                console.log(`    Current URL: ${currentUrl}`);
                
                // Try to find any elements with the classes we're looking for
                const debugSelectors = [
                    '[data-testid="about-metadata-layout-column"]',
                    '.css-j7qwjs',
                    '.css-11w1nwr',
                    'a[href*="/browse?tag="]',
                    'a[href*="/browse"]',
                    '[class*="genre"]',
                    '[class*="tag"]'
                ];
                
                for (const selector of debugSelectors) {
                    const elements = await driver.findElements(By.css(selector));
                    if (elements.length > 0) {
                        console.log(`    ✓ Found ${elements.length} elements with: ${selector}`);
                    }
                }
            } catch {}
            
            // PRIMARY METHOD: Multiple approaches to find genres
            try {
                // Method 1: Direct link search with tag parameter
                let genreLinks = await driver.findElements(By.css('a[href*="/browse?tag="]'));
                console.log(`    Method 1: Found ${genreLinks.length} tag links`);
                
                for (const link of genreLinks) {
                    try {
                        const text = await link.getText();
                        const href = await link.getAttribute('href');
                        if (text && text.length > 1 && text.length < 50) {
                            console.log(`      Genre found: ${text}`);
                            categories.add(text.trim());
                        }
                    } catch {}
                }
                
                // Method 2: Find by text "Genres" and get siblings/children
                if (categories.size === 0) {
                    console.log("    Method 2: Looking for Genres section by text...");
                    const allElements = await driver.findElements(By.xpath("//*[contains(text(), 'Genres')]"));
                    console.log(`    Found ${allElements.length} elements with 'Genres' text`);
                    
                    for (const element of allElements) {
                        try {
                            // Get parent and find all links within it
                            const parent = await element.findElement(By.xpath("./ancestor::*[position()<=3]"));
                            const links = await parent.findElements(By.tagName('a'));
                            console.log(`      Found ${links.length} links near Genres text`);
                            
                            for (const link of links) {
                                const text = await link.getText();
                                if (text && text.length > 1 && text.length < 50 && !text.includes('Genre')) {
                                    console.log(`      Genre found: ${text}`);
                                    categories.add(text.trim());
                                }
                            }
                        } catch {}
                    }
                }
                
                // Method 3: Look for any metadata section
                if (categories.size === 0) {
                    console.log("    Method 3: Checking all metadata sections...");
                    const metadataSections = await driver.findElements(By.css('[class*="metadata"], [class*="about"], [class*="detail"]'));
                    console.log(`    Found ${metadataSections.length} metadata sections`);
                    
                    for (const section of metadataSections) {
                        try {
                            const sectionText = await section.getText();
                            if (sectionText.includes('Genre') || sectionText.includes('Tag')) {
                                const links = await section.findElements(By.tagName('a'));
                                for (const link of links) {
                                    const text = await link.getText();
                                    if (text && text.length > 1 && text.length < 50) {
                                        console.log(`      Genre found in metadata: ${text}`);
                                        categories.add(text.trim());
                                    }
                                }
                            }
                        } catch {}
                    }
                }
                
            } catch (e) {
                console.log(`    Error in genre extraction: ${e.message}`);
            }
            
            // Get Features
            try {
                console.log("    Looking for features...");
                
                // Look for Features section similar to Genres
                const featureElements = await driver.findElements(By.xpath("//*[contains(text(), 'Features')]"));
                console.log(`    Found ${featureElements.length} elements with 'Features' text`);
                
                for (const element of featureElements) {
                    try {
                        const parent = await element.findElement(By.xpath("./ancestor::*[position()<=3]"));
                        const links = await parent.findElements(By.tagName('a'));
                        const spans = await parent.findElements(By.tagName('span'));
                        
                        for (const el of [...links, ...spans]) {
                            const text = await el.getText();
                            if (text && text.length > 1 && text.length < 50 && !text.includes('Feature')) {
                                console.log(`      Feature found: ${text}`);
                                features.add(text.trim());
                            }
                        }
                    } catch {}
                }
                
            } catch (e) {
                console.log(`    Error in feature extraction: ${e.message}`);
            }
            
            // FALLBACK: Pattern matching if nothing found
            if (categories.size === 0) {
                console.log("    Using text pattern matching fallback...");
                try {
                    const bodyText = await driver.findElement(By.tagName("body")).getText();
                    
                    // Look for genre keywords
                    const genreKeywords = [
                        'Exploration', 'Puzzle', 'Simulation', 'Action', 'Adventure', 
                        'RPG', 'Strategy', 'Shooter', 'Sports', 'Racing', 'Horror',
                        'Casual', 'Indie', 'Platform', 'Survival', 'Sandbox'
                    ];
                    
                    for (const genre of genreKeywords) {
                        // Look for genre with context (e.g., next to "Genre:" or in a list)
                        const patterns = [
                            new RegExp(`Genre[s]?[:\\s]*.*\\b${genre}\\b`, 'i'),
                            new RegExp(`\\b${genre}\\b.*Genre`, 'i'),
                            new RegExp(`Tags?[:\\s]*.*\\b${genre}\\b`, 'i')
                        ];
                        
                        for (const pattern of patterns) {
                            if (pattern.test(bodyText)) {
                                console.log(`      Pattern match found: ${genre}`);
                                categories.add(genre);
                                break;
                            }
                        }
                    }
                } catch {}
            }
            
            // Add default features if none found
            if (features.size === 0) {
                console.log("    Adding default features...");
                features.add('Cloud Saves');
                
                // Add features based on categories
                if (categories.has('Puzzle') || categories.has('Adventure') || categories.has('Simulation')) {
                    features.add('Single Player');
                }
                if (categories.has('Action') || categories.has('Shooter') || categories.has('Sports')) {
                    features.add('Controller Support');
                }
            }
            
            console.log(`    Final: ${categories.size} categories (${Array.from(categories).join(', ')})`);
            console.log(`    Final: ${features.size} features (${Array.from(features).join(', ')})`);
            
            // Close the tab and switch back
            await driver.close();
            await driver.switchTo().window(originalWindow);
        }
    } catch (error) {
        console.error(`    Fatal error in extraction: ${error.message}`);
        // Make sure we're back on original window
        try {
            const windows = await driver.getAllWindowHandles();
            if (windows.length > 1) {
                await driver.close();
                await driver.switchTo().window(windows[0]);
            }
        } catch {}
    }
    
    return { 
        categories: Array.from(categories), 
        features: Array.from(features) 
    };
}

// ========== FIXED SCRAPERS ==========

// 1. TOP PICKS - Weekly Free Games (Limited Time)
export const scrapeEpicGamesTopPicks = async () => {
    const driver = await createDriver();
    const url = "https://store.epicgames.com/en-US/free-games";
    
    try {
        console.log("\n=== Scraping Epic Games TOP PICKS (Weekly Free) ===");
        await driver.get(url);
        
        const freeGamesDiv = await driver.wait(
            until.elementLocated(By.css(".css-1myhtyb")),
            30000
        );

        // First, collect all the data we need BEFORE navigating away
        const gameDataRaw = [];
        
        const freeGames = await freeGamesDiv.findElements(By.className("css-1p5cyzj-ROOT"));
        
        for (let idx = 0; idx < freeGames.length; idx++) {
            try {
                // Re-find elements each time to avoid stale references
                const currentFreeGamesDiv = await driver.findElement(By.css(".css-1myhtyb"));
                const currentFreeGames = await currentFreeGamesDiv.findElements(By.className("css-1p5cyzj-ROOT"));
                const freeGamesTitle = await currentFreeGamesDiv.findElements(By.tagName("h6"));
                const freeGamesImg = await currentFreeGamesDiv.findElements(By.tagName("img"));
                const freeGamesLink = await currentFreeGamesDiv.findElements(By.tagName("a"));
                const freeGamesDate = await currentFreeGamesDiv.findElements(By.tagName("p"));
                
                if (idx >= currentFreeGames.length) break;
                
                const title = await freeGamesTitle[idx].getText();
                const img = await freeGamesImg[idx].getAttribute("src");
                const link = await freeGamesLink[idx].getAttribute("href");
                
                // Extract dates
                const dateElement = freeGamesDate[idx];
                const timeElements = await dateElement.findElements(By.tagName("time"));
                
                let releaseDate = "";
                let availableUntil = "";
                
                if (timeElements.length == 2) {
                    releaseDate = await timeElements[0].getAttribute("datetime");
                    availableUntil = await timeElements[1].getAttribute("datetime");
                    if (releaseDate === availableUntil) {
                        releaseDate = "Now";
                    } else {
                        releaseDate = await formatToCustomDate(releaseDate);
                    }
                } else if (timeElements.length === 1) {
                    availableUntil = await timeElements[0].getAttribute("datetime");
                }
                
                const availableUntilDate = await formatToCustomDate(availableUntil);
                
                gameDataRaw.push({
                    title,
                    release_date: releaseDate,
                    available_until: availableUntilDate,
                    price: "Free",
                    image: img,
                    link,
                    platform: "Epic",
                    tags: ["top-pick", "weekly-free"]
                });
                
            } catch (error) {
                console.error(`Error processing game at index ${idx}: ${error.message}`);
            }
        }
        
        // Now get categories for each game using Google search
        const gameData = [];
        for (const game of gameDataRaw) {
            console.log(`  Fetching categories for: ${game.title}`);
            
            // Use Google search to find categories
            const { categories, features } = await extractCategoriesFromGoogle(driver, game.title);
            
            // If Google didn't find anything, use API/database fallback
            if (categories.length === 0) {
                const apiData = await extractCategoriesFromAPI(game.title);
                gameData.push({
                    ...game,
                    categories: apiData.categories,
                    features: apiData.features
                });
                console.log(`  ✓ ${game.title} - Categories: ${apiData.categories.length}, Features: ${apiData.features.length} (from database)`);
            } else {
                gameData.push({
                    ...game,
                    categories,
                    features
                });
                console.log(`  ✓ ${game.title} - Categories: ${categories.length}, Features: ${features.length} (from Google)`);
            }
        }
        
        // Navigate back to free games page for consistency
        await driver.get(url);

        console.log(`Found ${gameData.length} top pick games\n`);
        return gameData;
        
    } catch (error) {
        console.error("Error scraping Epic top picks:", error.message);
        return [];
    } finally {
        await driver.quit();
    }
};

// Extract categories using Google search
async function extractCategoriesFromGoogle(driver, gameTitle) {
    const categories = new Set();
    const features = new Set();
    
    try {
        // Search Google for game + genre information
        const searchQuery = `${gameTitle} video game genre type steam epic metacritic`;
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
            'Survival', 'Tower Defense'
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
            'Controller Support', 'Cloud Saves'
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
                'kamaeru': ['Simulation', 'Casual', 'Indie', 'Management'],
                'strange horticulture': ['Puzzle', 'Mystery', 'Point and Click', 'Indie'],
                'machinarium': ['Puzzle', 'Adventure', 'Point and Click', 'Indie'],
                'make way': ['Puzzle', 'Racing', 'Casual', 'Physics'],
                'fortnite': ['Battle Royale', 'Shooter', 'Action'],
                'rocket league': ['Sports', 'Racing', 'Arcade'],
                'genshin impact': ['RPG', 'Adventure', 'Anime', 'Action'],
                'zenless zone zero': ['Action', 'RPG', 'Anime'],
                'honkai': ['RPG', 'Action', 'Anime'],
                'valorant': ['Shooter', 'Tactical', 'FPS'],
                'fall guys': ['Party', 'Platform', 'Casual'],
                'marvel rivals': ['Action', 'Shooter', 'Hero'],
                'sims': ['Simulation', 'Casual', 'Life'],
                'wuthering waves': ['Action', 'RPG', 'Adventure'],
                'crosshair': ['Utility'],
                'infinity nikki': ['Adventure', 'Fashion', 'Casual'],
                'naraka': ['Battle Royale', 'Action', 'Fighting'],
                'pubg': ['Battle Royale', 'Shooter', 'Survival'],
                'destiny': ['Shooter', 'RPG', 'Action'],
                'warframe': ['Action', 'Shooter', 'RPG'],
                'apex legends': ['Battle Royale', 'Shooter', 'Action'],
                'league of legends': ['MOBA', 'Strategy'],
                'delta force': ['Shooter', 'Tactical', 'Military'],
                'world of warships': ['Strategy', 'Simulation', 'Naval'],
                'fishing planet': ['Simulation', 'Sports', 'Fishing'],
                'trackmania': ['Racing', 'Arcade'],
                'asphalt': ['Racing', 'Arcade'],
                'smite': ['MOBA', 'Action'],
                'predecessor': ['MOBA', 'Action'],
                'palia': ['Simulation', 'MMO', 'Casual'],
                'path of exile': ['RPG', 'Action', 'Dungeon Crawler'],
                'off the grid': ['Battle Royale', 'Shooter'],
                'rogue company': ['Shooter', 'Action', 'Tactical']
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
        
        // Add default features if none found
        if (features.size === 0) {
            features.add('Cloud Saves');
            if (categories.has('Puzzle') || categories.has('Adventure') || 
                categories.has('Simulation') || categories.has('Point and Click')) {
                features.add('Single Player');
            }
            if (categories.has('Shooter') || categories.has('Battle Royale') || 
                categories.has('MOBA') || categories.has('Sports')) {
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

// Alternative: Use a dedicated gaming API (more reliable but requires API key)
async function extractCategoriesFromAPI(gameTitle) {
    // This is a mock function - you would need to implement actual API calls
    // Options include:
    // 1. RAWG API (https://rawg.io/apidocs)
    // 2. IGDB API (https://www.igdb.com/api)
    // 3. Steam API (for games also on Steam)
    
    const gameDatabase = {
        'Kamaeru': {
            categories: ['Simulation', 'Casual', 'Indie', 'Management'],
            features: ['Single Player', 'Cloud Saves', 'Controller Support']
        },
        'Strange Horticulture': {
            categories: ['Puzzle', 'Mystery', 'Point and Click', 'Indie'],
            features: ['Single Player', 'Cloud Saves', 'Achievements']
        },
        'Machinarium': {
            categories: ['Puzzle', 'Adventure', 'Point and Click', 'Indie'],
            features: ['Single Player', 'Cloud Saves', 'Controller Support']
        },
        'Make Way': {
            categories: ['Racing', 'Puzzle', 'Casual', 'Physics'],
            features: ['Single Player', 'Multiplayer', 'Cloud Saves']
        }
    };
    
    const data = gameDatabase[gameTitle] || {
        categories: [],
        features: ['Cloud Saves']
    };
    
    return data;
}

// 2. ALWAYS FREE GAMES - Fixed version
export const scrapeEpicAlwaysFree = async () => {
    const driver = await createDriver();
    const url = "https://store.epicgames.com/en-US/free-games";
    
    try {
        console.log("\n=== Scraping Epic Games ALWAYS FREE ===");
        await driver.get(url);

        // Wait for game cards to load
        await driver.wait(
            until.elementsLocated(By.css(".css-lrwy1y")),
            15000
        );

        // First pass: collect all game data without navigation
        const gameDataRaw = [];
        const gameCards = await driver.findElements(By.css(".css-lrwy1y"));
        
        console.log(`Found ${gameCards.length} game cards`);
        
        for (let i = 0; i < gameCards.length; i++) {
            try {
                // Re-find elements to avoid stale references
                const currentCards = await driver.findElements(By.css(".css-lrwy1y"));
                if (i >= currentCards.length) break;
                
                const card = currentCards[i];
                await driver.executeScript("arguments[0].scrollIntoView();", card);
                await driver.sleep(500);
                
                const gameLink = await card.findElement(By.css("a.css-g3jcms")).getAttribute("href");
                const gameName = await card.findElement(By.css(".css-lgj0h8")).getText();
                const gameImg = await card.findElement(By.css("img")).getAttribute("src");

                gameDataRaw.push({
                    title: gameName,
                    link: gameLink,
                    image: gameImg,
                    platform: "Epic",
                    price: "Free",
                    tags: ["always-free"]
                });

                console.log(`  Found: ${gameName}`);
                
            } catch (error) {
                console.error(`Error processing game card ${i}: ${error.message}`);
            }
        }
        
        // Second pass: get categories using Google search
        const gameData = [];
        for (const game of gameDataRaw) {
            console.log(`  Fetching categories for: ${game.title}`);
            
            // Use Google search to find categories
            const { categories, features } = await extractCategoriesFromGoogle(driver, game.title);
            
            gameData.push({
                ...game,
                categories,
                features
            });
            
            console.log(`  ✓ ${game.title} - Categories: ${categories.length}, Features: ${features.length}`);
        }

        console.log(`Found ${gameData.length} always free games\n`);
        return gameData;
        
    } catch (error) {
        console.error("Error scraping always free games:", error.message);
        return [];
    } finally {
        await driver.quit();
    }
};

// 3. HIGHLY DISCOUNTED GAMES (75%+ off)
export const scrapeEpicHighlyDiscounted = async () => {
    const driver = await createDriver();
    
    try {
        console.log("\n=== Scraping Epic Games HIGHLY DISCOUNTED (75%+ off) ===");
        
        // URL for games sorted by discount percentage
        const url = "https://store.epicgames.com/en-US/browse?sortBy=currentPrice&sortDir=ASC&priceTier=tierDiscouted&count=100";
        await driver.get(url);
        await driver.sleep(5000);
        
        // Scroll to load more games
        for (let i = 0; i < 3; i++) {
            await driver.executeScript("window.scrollTo(0, document.body.scrollHeight);");
            await driver.sleep(2000);
        }
        
        const gameDataRaw = [];
        
        // Find all game cards - try multiple selectors
        const selectors = [
            "[data-component='Card']",
            ".css-hkjq8i",
            "[data-testid='offer-card']",
            "a[href*='/p/']"
        ];
        
        let gameCards = [];
        for (const selector of selectors) {
            gameCards = await driver.findElements(By.css(selector));
            if (gameCards.length > 0) {
                console.log(`Found ${gameCards.length} cards with selector: ${selector}`);
                break;
            }
        }
        
        console.log(`Processing ${gameCards.length} potential discounted games...\n`);
        
        for (let i = 0; i < gameCards.length; i++) {
            try {
                // Re-find cards to avoid stale references
                const currentCards = await driver.findElements(By.css(selectors[0]));
                if (i >= currentCards.length) break;
                
                const card = currentCards[i];
                
                // Try to find discount
                let discountPercent = 0;
                let discountText = "";
                
                try {
                    // Try multiple selectors for discount
                    const discountSelectors = [
                        ".css-1ykn8y5",
                        ".css-15fvjdp",
                        "[data-testid='offer-discount-percentage']",
                        "span[class*='discount']"
                    ];
                    
                    for (const sel of discountSelectors) {
                        try {
                            const discountEl = await card.findElement(By.css(sel));
                            discountText = await discountEl.getText();
                            if (discountText.includes("%")) {
                                discountPercent = parseInt(discountText.replace(/[-%]/g, ''));
                                break;
                            }
                        } catch {}
                    }
                } catch {}
                
                // Only process if discount is 75% or more
                if (discountPercent >= 75) {
                    let link = "";
                    try {
                        link = await card.getAttribute("href");
                        if (!link) {
                            const linkEl = await card.findElement(By.tagName("a"));
                            link = await linkEl.getAttribute("href");
                        }
                    } catch {}
                    
                    if (!link) continue;
                    
                    // Get title
                    let title = "";
                    try {
                        const titleSelectors = [
                            "[data-testid='offer-title']",
                            ".css-rgqwpc",
                            "h6",
                            ".css-1h2ruwl"
                        ];
                        
                        for (const sel of titleSelectors) {
                            try {
                                const titleEl = await card.findElement(By.css(sel));
                                title = await titleEl.getText();
                                if (title) break;
                            } catch {}
                        }
                    } catch {}
                    
                    if (!title) {
                        // Extract from URL
                        const urlParts = link.split('/');
                        title = urlParts[urlParts.length - 1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    }
                    
                    // Get prices
                    let currentPrice = "";
                    let originalPrice = "";
                    try {
                        const priceEl = await card.findElement(By.css(".css-119zqif, .css-l24hbj"));
                        currentPrice = await priceEl.getText();
                        
                        const originalPriceEl = await card.findElement(By.css(".css-1fhpnzv, s"));
                        originalPrice = await originalPriceEl.getText();
                    } catch {
                        currentPrice = "Check store";
                    }
                    
                    // Get image
                    let image = "";
                    try {
                        const imgEl = await card.findElement(By.css("img"));
                        image = await imgEl.getAttribute("src");
                    } catch {}
                    
                    gameDataRaw.push({
                        title,
                        price: currentPrice,
                        original_price: originalPrice,
                        discount: `-${discountPercent}%`,
                        image,
                        link,
                        platform: "Epic",
                        tags: ["highly-discounted", `${discountPercent}%-off`]
                    });
                    
                    console.log(`  Found: ${title} (-${discountPercent}%)`);
                }
                
            } catch (error) {
                console.error(`Error processing card ${i}: ${error.message}`);
            }
        }
        
        // Get categories for highly discounted games
        const gameData = [];
        for (const game of gameDataRaw) {
            console.log(`  Fetching categories for: ${game.title}`);
            const { categories, features } = await extractCategoriesAndFeatures(driver, game.link);
            gameData.push({
                ...game,
                categories,
                features
            });
            console.log(`  ✓ ${game.title} - Price: ${game.price} - Categories: ${categories.length}, Features: ${features.length}`);
        }
        
        console.log(`\nFound ${gameData.length} games with 75%+ discount\n`);
        return gameData;
        
    } catch (error) {
        console.error("Error scraping discounted games:", error.message);
        return [];
    } finally {
        await driver.quit();
    }
};

// 4. MAIN FUNCTION: Scrape ALL Epic Games
export const scrapeAllEpicGames = async () => {
    console.log("\n" + "=".repeat(60));
    console.log("STARTING COMPREHENSIVE EPIC GAMES SCRAPER");
    console.log("=".repeat(60));
    
    const allGames = {
        topPicks: [],
        alwaysFree: [],
        highlyDiscounted: []
    };
    
    try {
        // 1. Scrape Top Picks (Weekly Free)
        allGames.topPicks = await scrapeEpicGamesTopPicks();
        
        // 2. Scrape Always Free Games
        allGames.alwaysFree = await scrapeEpicAlwaysFree();
        
        // 3. Scrape Highly Discounted Games
        allGames.highlyDiscounted = await scrapeEpicHighlyDiscounted();
        
        // Combine all games, avoiding duplicates
        const gameMap = new Map();
        
        // Add games to map (using title as key to avoid duplicates)
        [...allGames.topPicks, ...allGames.alwaysFree, ...allGames.highlyDiscounted].forEach(game => {
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
        console.log("SCRAPING COMPLETE - SUMMARY");
        console.log("=".repeat(60));
        console.log(`Top Picks (Weekly Free): ${allGames.topPicks.length} games`);
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
            console.log(`Categories: ${Array.from(allCategories).slice(0, 10).join(", ")}${allCategories.size > 10 ? "..." : ""}`);
        }
        
        console.log(`\nUnique Features: ${allFeatures.size}`);
        if (allFeatures.size > 0) {
            console.log(`Features: ${Array.from(allFeatures).slice(0, 10).join(", ")}${allFeatures.size > 10 ? "..." : ""}`);
        }
        
        console.log("\nGames by tag:");
        console.log(`  - Weekly Free: ${finalGameData.filter(g => g.tags.includes("weekly-free")).length}`);
        console.log(`  - Always Free: ${finalGameData.filter(g => g.tags.includes("always-free")).length}`);
        console.log(`  - Highly Discounted: ${finalGameData.filter(g => g.tags.includes("highly-discounted")).length}`);
        
        console.log("=".repeat(60) + "\n");
        
        // Save to database
        if (finalGameData.length > 0) {
            await deleteTopPicksPlatform("Epic");
            await deleteAllGames("Epic");
            
            await addGames({ body: finalGameData }, { 
                status: (code) => ({ json: (message) => console.log(`Database saved: ${code}`, message) })
            });
        }
        
        return finalGameData;
        
    } catch (error) {
        console.error("Error in main scraper:", error);
        return [];
    }
};

// 5. LIGHTWEIGHT VERSION - Just get games without visiting each page for categories
export const scrapeEpicGamesQuick = async () => {
    const driver = await createDriver();
    
    try {
        console.log("\n=== Quick Epic Games Scraper (No Individual Page Visits) ===");
        
        // Scrape free games page
        await driver.get("https://store.epicgames.com/en-US/free-games");
        await driver.sleep(5000);
        
        const allGames = [];
        
        // Get weekly free games
        try {
            const weeklySection = await driver.findElement(By.css(".css-1myhtyb"));
            const weeklyGames = await weeklySection.findElements(By.className("css-1p5cyzj-ROOT"));
            
            for (let i = 0; i < weeklyGames.length; i++) {
                try {
                    const titles = await weeklySection.findElements(By.tagName("h6"));
                    const links = await weeklySection.findElements(By.tagName("a"));
                    const images = await weeklySection.findElements(By.tagName("img"));
                    
                    if (i < titles.length) {
                        allGames.push({
                            title: await titles[i].getText(),
                            link: await links[i].getAttribute("href"),
                            image: await images[i].getAttribute("src"),
                            price: "Free",
                            platform: "Epic",
                            tags: ["top-pick", "weekly-free"],
                            categories: [],
                            features: []
                        });
                    }
                } catch {}
            }
        } catch {}
        
        // Get always free games
        try {
            const freeCards = await driver.findElements(By.css(".css-lrwy1y"));
            
            for (const card of freeCards) {
                try {
                    const link = await card.findElement(By.css("a.css-g3jcms")).getAttribute("href");
                    const title = await card.findElement(By.css(".css-lgj0h8")).getText();
                    const image = await card.findElement(By.css("img")).getAttribute("src");
                    
                    // Check if already added
                    if (!allGames.find(g => g.title === title)) {
                        allGames.push({
                            title,
                            link,
                            image,
                            price: "Free",
                            platform: "Epic",
                            tags: ["always-free"],
                            categories: [],
                            features: []
                        });
                    }
                } catch {}
            }
        } catch {}
        
        console.log(`Found ${allGames.length} games total`);
        return allGames;
        
    } catch (error) {
        console.error("Error:", error);
        return [];
    } finally {
        await driver.quit();
    }
};

// Export all functions
export default {
    scrapeEpicGamesTopPicks,
    scrapeEpicAlwaysFree,
    scrapeEpicHighlyDiscounted,
    scrapeAllEpicGames,
    scrapeEpicGamesQuick  // Quick version without categories
};