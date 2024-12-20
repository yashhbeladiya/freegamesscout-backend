import { By, until } from "selenium-webdriver";
import { createDriver } from "../utils/util.js"; // Custom driver function
import database from "../database/database.js"; // Optional: Adjust based on your database setup
import { addGames } from "../controller/game.controller.js";

export const scrapeEpicGames = async () => {
    const driver = await createDriver(); // Use the custom driver function

    const url = "https://store.epicgames.com/en-US/free-games";
    try {
        // Navigate to the Epic Games Free Games page
        await driver.get(url);

        // Wait for the free games section to load
        const freeGamesDiv = await driver.wait(
            until.elementLocated(By.css(".css-1myhtyb")),
            15000 // Wait up to 15 seconds
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
                const releaseDate = await dateElement.findElement(By.xpath(".//time[1]")).getText();
                const availableUntil = await dateElement.findElement(By.xpath(".//time[2]")).getText();

                // Price is always "Free" for this scraper
                const price = "Free";

                const gameRow = {
                    title,
                    release_date: releaseDate,
                    available_until: availableUntil,
                    price,
                    image: img,
                    link,
                    platform: "Epic",
                };

                // Save to the database (if applicable)
                await database.save(gameRow);

                // Add to gameData array
                gameData.push(gameRow);
            } catch (error) {
                console.error(`Error processing game at index ${idx}: ${error.message}`);
            }
        }

        console.log("Scraped Free Games Data:", gameData);

        if (gameData.length > 0) {
            // Before saving delete all the previous data
            await database.deleteAllGames("Epic"); 

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

export default scrapeEpicGames;
