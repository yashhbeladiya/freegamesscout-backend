import { By, until } from "selenium-webdriver";
import { createDriver, formatToCustomDate } from "../utils/util.js"; // Custom driver function
import { addGames, deleteAllGames, deleteTopPicksPlatform } from "../controller/game.controller.js";

export const scrapeEpicGames = async () => {
    const driver = await createDriver(); // Use the custom driver function

    const url = "https://store.epicgames.com/en-US/free-games";
    try {
        // Navigate to the Epic Games Free Games page
        await driver.get(url);

        // Wait for the free games section to load
        const freeGamesDiv = await driver.wait(
            until.elementLocated(By.css(".css-1myhtyb")),
            30000 // Wait up to 15 seconds
        );

        // Fetch all free game elements
        const freeGames = await freeGamesDiv.findElements(By.className("css-1p5cyzj-ROOT"));
        const freeGamesTitle = await freeGamesDiv.findElements(By.tagName("h6"));
        const freeGamesImg = await freeGamesDiv.findElements(By.tagName("img"));
        const freeGamesLink = await freeGamesDiv.findElements(By.tagName("a"));
        const freeGamesDate = await freeGamesDiv.findElements(By.tagName("p"));

        const gameData = [];

        // Iterate through the free games and extract details
        for (let idx = 0; idx < freeGames.length; idx++) {
            try {
                const title = await freeGamesTitle[idx].getText();
                const img = await freeGamesImg[idx].getAttribute("src");
                const link = await freeGamesLink[idx].getAttribute("href");

                // Extract dates (release date and available until)
                const dateElement = freeGamesDate[idx];
                const timeElements = await dateElement.findElements(By.tagName("time"));
                
                let releaseDate = "";
                let availableUntil = "";

                if (timeElements.length >= 2) {
                    // Extract release date and availability end date
                    releaseDate = await timeElements[0].getAttribute("datetime");
                    availableUntil = await timeElements[1].getAttribute("datetime");
                } else if (timeElements.length === 1) {
                    // If only one time element is present, assume it's the available until date
                    availableUntil = await timeElements[0].getAttribute("datetime");
                }

                // Format the dates
                const availableUntilDate = await formatToCustomDate(availableUntil);

                // Price is always "Free" for this scraper
                const price = "Free";

                const gameRow = {
                    title,
                    release_date: "Now", // No release date available
                    available_until: availableUntilDate,
                    price,
                    image: img,
                    link,
                    platform: "Epic",
                    tags: ["top-pick"],
                };

                // Add to gameData array
                gameData.push(gameRow);
            } catch (error) {
                console.error(`Error processing game at index ${idx}: ${error.message}`);
            }
        }

        if (gameData.length > 0) {
            // Save the game data to the database
            await addGames({ body: gameData }, { 
                status: (code) => ({ json: (message) => console.log(code, message) })
            }); // Simulate the request/response interface
        }

        return gameData;
    } catch (error) {
        console.error("Error scraping Epic Games:", error.message);
        throw error;
    } finally {
        // Quit the driver after scraping
        await driver.quit();
    }
};

export const scrapeFreeEpicGames = async () => {
    const driver = await createDriver(); // Ensure this works correctly

    console.log("Scraping Free Epic Games...");

    const url = "https://store.epicgames.com/en-US/free-games";
    try {
        await driver.get(url);

        // Wait for the game cards to be loaded
        const gameCards = await driver.wait(
            until.elementsLocated(By.css(".css-lrwy1y")),
            15000 // Wait up to 15 seconds
        );

        const gameData = [];

        for (let card of gameCards) {
            try {
                // Scroll into view
                await driver.executeScript("arguments[0].scrollIntoView();", card);

                // Extract game details
                const gameLink = await card.findElement(By.css("a.css-g3jcms")).getAttribute("href");
                const gameName = await card.findElement(By.css(".css-lgj0h8")).getText();
                const gameImg = await card.findElement(By.css("img")).getAttribute("src");

                gameData.push({
                    title: gameName,
                    link: gameLink, // No need to prepend the base URL
                    image: gameImg,
                    platform: "Epic",
                    price: "Free",
                });

                console.log("Scraped Epic Game:", gameName);
            } catch (error) {
                console.error(`Error processing a game card: ${error.message}`);
            }
        }

        if (gameData.length > 0) {
            console.log(`Found ${gameData.length} games. Saving to database...`);

            await deleteAllGames('Epic');

            // Clear previous data and save the new data
            await addGames({ body: gameData }, {
                status: (code) => ({
                    json: (message) => console.log(`Status ${code}:`, message),
                }),
            });

            console.log("Games saved successfully.");
        } else {
            console.warn("No games found.");
        }

        return gameData;
    } catch (error) {
        console.error("Error scraping Epic Games:", error.message);
        throw error;
    } finally {
        await driver.quit();
    }
};
