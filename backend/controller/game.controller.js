import Game from "../model/game.model.js";

export const addGames = async (req, res) => {
    try {
        // Validate input
        if (!Array.isArray(req.body)) {
            return res.status(400).json({ message: "Invalid data format. Expected an array of games." });
        }

        const games = req.body;

        // Prepare upsert operations to avoid duplicates
        const bulkOps = games.map(game => ({
            updateOne: {
                filter: { link: game.link, platform: game.platform },
                update: { $set: game }, // Update fields if the game exists
                upsert: true, // Insert the game if it doesn't exist
            },
        }));

        // Execute bulkWrite operation
        const result = await Game.bulkWrite(bulkOps);

        // Return success response with details
        res.status(201).json({
            message: "Games added successfully.",
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
            upsertedCount: result.upsertedCount,
        });
    } catch (error) {
        if (error.code === 11000) {
            // Handle duplicate key error
            console.error("Duplicate key error:", error);
            return res.status(409).json({ message: "Duplicate key error. A game with the same title already exists." });
        }
        console.error("Error adding games:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

export const getGames = async (req, res) => {
    try {
        console.log("Fetching games...");
        const games = await Game.find().sort({ release_date: -1 });
        console.log("Games fetched successfully.");
        res.status(200).json(games);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};

export const getEpicGames = async (req, res) => {
    try {
        const games = await Game.find({ platform: "Epic" }).sort({ release_date: -1 });
        res.status(200).json(games);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
}

export const getSteamGames = async (req, res) => {
    try {
        const games = await Game.find({ platform: "Steam" }).sort({ release_date: -1 });
        res.status(200).json(games);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
}

export const getPrimeGames = async (req, res) => {
    try {
        const games = await Game.find({ platform: "Prime Gaming" });
        res.status(200).json(games);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
}

export const getSeachedGames = async (req, res) => {
    try {
        const { search } = req.query;
        const games = await Game.find({ title: { $regex: search, $options: "i" } }).sort({ release_date: -1 });
        res.status(200).json(games);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
}

export const deleteAllGames = async (req, res) => {
    try {
        req.body = { platform: req.params.platform };
        await Game.deleteMany({});
        res.status(200).json({ message: "All games deleted successfully." });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}