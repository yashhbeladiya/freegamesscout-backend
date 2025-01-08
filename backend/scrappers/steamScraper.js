// import { By, until } from "selenium-webdriver";
// import { createDriver } from "../utils/util.js";
// import { addGames, deleteAllGames } from "../controller/game.controller.js";

// export const scrapeSteamGames = async () => {
//   const driver = await createDriver(); // Use the custom driver function
//   const url =
//     "https://store.steampowered.com/search/?sort_by=Price_ASC&supportedlang=english";
//   const gameData = [];

//   try {
//     console.log("Scraping Steam games...");

//     // Open the Steam search page
//     await driver.get(url);

//     // Allow time for the page to load
//     await driver.sleep(5000); // Adjust as needed for Steam's loading time

//     while (true) {
//       const freeGamesDiv = await driver.findElement(
//         By.className("search_results")
//       );
//       const freeGames = await freeGamesDiv.findElements(
//         By.className("search_result_row")
//       );

//       for (let i = 0; i < freeGames.length; i++) {
//         try {
//           // // Re-locate elements to avoid stale element reference
//           // const freeGamesDiv = await driver.findElement(By.className("search_results"));
//           // const freeGames = await freeGamesDiv.findElements(By.className("search_result_row"));
//           const game = freeGames[i];

//           // Scroll into view
//           await driver.executeScript("arguments[0].scrollIntoView();", game);

//           // Extract game details
//           const title = await game.findElement(By.className("title")).getText();
//           const releaseDate = await game
//             .findElement(By.className("search_released"))
//             .getText();

//           // const priceElement = await game.findElement(By.xpath("//*[contains(@class, 'price')]"));
//           let price = "Free";
//           try {
//             const priceElement = await game
//               .findElement(By.className("discount_prices"))
//               .findElement(By.className("discount_final_price"));
//             price = priceElement
//               ? (await priceElement.getText()).trim()
//               : "Free";
//           } catch (error) {
//             console.error(`Error extracting price for game ${i}: ${error}`);
//           }

//           // Game link
//           const link = await game.getAttribute("href");

//           // Navigate to the game page to fetch the image
//           await driver.executeScript("window.open(arguments[0])", link);
//           const tabs = await driver.getAllWindowHandles();
//           await driver.switchTo().window(tabs[1]); // Switch to the new tab
//           await driver.sleep(5000); // Allow the game page to load

//           let gameImage = "Image not found";
//           try {
//             const gameImageElement = await driver.findElement(
//               By.className("game_header_image_full")
//             );
//             gameImage = await gameImageElement.getAttribute("src");
//           } catch (error) {
//             const gameImageElement = await driver.findElement(
//               By.className("img_ctn")
//             );
//             gameImage = await gameImageElement.getAttribute("src");
//           }

//           // Return back to the original search page
//           await driver.close(); // Close the tab
//           await driver.switchTo().window(tabs[0]); // Switch back to the original tab

//           // Add the game data
//           let rowData = {
//             title,
//             releaseDate,
//             availableUntil: "", // Steam doesn't list this
//             price,
//             image: gameImage,
//             link,
//             platform: "Steam",
//             tag: [""],
//           };
//           if (price === "$0.00") {
//             rowData = {
//                 title,
//                 releaseDate,
//                 availableUntil: "", // Steam doesn't list this
//                 price,
//                 image: gameImage,
//                 link,
//                 platform: "Steam",
//                 tag: ["top-pick"],
//               };
//             console.log(`Found a top-pick steam game: ${title}`);
//           }

//           console.log(`Scraped game ${i}: ${title} - ${price}`);

//           // Example: push data to your desired storage (gameData list)
//           gameData.push(rowData);
//         } catch (error) {
//           console.error(`Error scraping game ${i}: ${error}`);
//         }
//       }

//       // Scroll down to load more games
//       const lastHeight = await driver.executeScript(
//         "return document.body.scrollHeight"
//       );
//       await driver.executeScript(
//         "window.scrollTo(0, document.body.scrollHeight);"
//       );
//       await driver.sleep(3000);
//       const newHeight = await driver.executeScript(
//         "return document.body.scrollHeight"
//       );

//       // Break the loop if no new games are loaded
//       if (newHeight === lastHeight) {
//         break;
//       }
//     }
//   } catch (error) {
//     console.error(`Error scraping Steam games: ${error}`);
//   }

//   await driver.quit(); // Close the driver
//   // console.log("Scraped Steam Games Data:", gameData);

//   if (gameData.length > 0) {
//     // Before saving delete all the previous data
//     await deleteAllGames("Steam");

//     await addGames(
//       { body: gameData },
//       {
//         status: (code) => ({ json: (message) => console.log(code, message) }),
//       }
//     ); // Simulate the request/response interface
//   }

//   return gameData; // Return the scraped data
// };

// export default scrapeSteamGames;

import { By } from "selenium-webdriver";
import { createDriver } from "../utils/util.js";
import { addGames, deleteAllGames } from "../controller/game.controller.js";

export const scrapeSteamGames = async () => {
  let driver = await createDriver();
  const url = "https://store.steampowered.com/search/?sort_by=Price_ASC&supportedlang=english";
  const gameData = new Set();
  const processedTitles = new Set();

  try {
    console.log("Scraping Steam games...");
    await driver.get(url);
    await driver.sleep(5000);

    let previousHeight = 0;
    let noNewContentCount = 0;
    const MAX_RETRIES = 3;

    while (noNewContentCount < MAX_RETRIES) {
      const freeGames = await driver.findElements(By.className("search_result_row"));

      for (const game of freeGames) {
        try {
          await driver.executeScript("arguments[0].scrollIntoView();", game);
          const title = await game.findElement(By.className("title")).getText();
          
          if (processedTitles.has(title)) continue;
          
          const releaseDate = await game.findElement(By.className("search_released")).getText();
          const link = await game.getAttribute("href");
          let price = "Free";
          
          try {
            const priceElement = await game.findElement(By.className("discount_final_price"));
            price = await priceElement.getText();
          } catch {
            // Price element not found, keep as "Free"
          }

          // Open new tab
          const newTab = await driver.executeScript("window.open(arguments[0])", link);
          const tabs = await driver.getAllWindowHandles();
          await driver.switchTo().window(tabs[1]);
          await driver.sleep(3000);

          let gameImage = "Image not found";
          try {
            const imageElement = await driver.findElement(By.className("game_header_image_full")) ||
                               await driver.findElement(By.className("img_ctn"));
            gameImage = await imageElement.getAttribute("src");
          } catch (error) {
            console.error(`Image not found for ${title}: ${error.message}`);
          }

          // Always close the new tab and switch back
          await driver.close();
          await driver.switchTo().window(tabs[0]);

          const rowData = {
            title,
            releaseDate,
            availableUntil: "",
            price: price.trim(),
            image: gameImage,
            link,
            platform: "Steam",
            tags: price === "$0.00" ? ["top-pick"] : [""]
          };

          processedTitles.add(title);
          gameData.add(JSON.stringify(rowData));
          console.log(`Scraped: ${title}`);
        } catch (error) {
          console.error(`Error processing game: ${error.message}`);
          // Ensure we're on the main tab
          const tabs = await driver.getAllWindowHandles();
          if (tabs.length > 1) {
            await driver.close();
            await driver.switchTo().window(tabs[0]);
          }
        }
      }

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
  } catch (error) {
    console.error(`Scraping error: ${error.message}`);
  } finally {
    await driver.quit();
  }

  const uniqueGameData = Array.from(gameData).map(game => JSON.parse(game));
  
  if (uniqueGameData.length > 0) {
    await deleteAllGames("Steam");
    await addGames(
      { body: uniqueGameData },
      { status: (code) => ({ json: (message) => console.log(code, message) }) }
    );
  }

  return uniqueGameData;
};

export default scrapeSteamGames;