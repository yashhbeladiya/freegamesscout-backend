import { By, until } from "selenium-webdriver";
import { createDriver, convertCountdownToDate } from "../utils/util.js"; // Custom driver function
import { addGames, deleteAllGames, deleteTopPicksPlatform } from "../controller/game.controller.js";

export const scrapeGOGGiveaway = async () => {
    // Set up the WebDriver options
    const driver = await createDriver();

    try {
        const url = "https://www.gog.com/en/";
        await driver.get(url);

        const gameData = [];

        // Wait for the game elements to be loaded
        const giveawayHeader = await driver.wait(
            until.elementLocated(By.css(".giveaway__content-header")),
            15000
        );

        // Extract the game name
        const gameName = (await giveawayHeader.getText()).split(":")[1].trim();

        // Extract the game link
        const gameLink = await driver.findElement(By.css("a.giveaway__overlay-link")).getAttribute("href");

        // Extract the availability
        const availability = await driver.findElement(By.css(".giveaway__countdown")).getText();
        const availableUntil = await convertCountdownToDate(availability);

        // Extract the image link from <source> inside <picture>
        const imageSources = await driver.findElements(By.css("picture.giveaway__image source"));
        let imageLink = null;

        for (const source of imageSources) {
            const srcset = await source.getAttribute("srcset");
            if (srcset) {
                imageLink = srcset.split(",")[0].trim(); // Take the first image link from srcset
                break;
            }
        }

        // Store the game data
        gameData.push({
            title: gameName,
            release_date: new Date().toLocaleDateString(),
            available_until: availableUntil,
            price: "Free",
            image: imageLink,
            link: gameLink,
            platform: "GOG",
            tags: ["top-pick"],
        });

        console.log("Got game data:", gameData);

        // Add the game data to the database
        if (gameData.length > 0) {
            await deleteTopPicksPlatform("GOG");
            await addGames({ body: gameData }, {
                status: (code) => ({
                    json: (message) => console.log(`Status ${code}:`, message),
                }),
            });
            console.log("GOG Giveaway scraped successfully.");
        }

        return gameData;
    } catch (error) {
        console.error("Error scraping GOG Giveaway:", error);
    } finally {
        // Close the driver
        await driver.quit();
    }
}


export default scrapeGOGGiveaway;
