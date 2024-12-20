import mongoose from "mongoose";

const gameSchema = new mongoose.Schema({
  title: { type: String, required: true, unique: true },
  release_date: String,
  available_until: String,
  price: { type: String, required: true, default: 'Free' },
  image: String,
  link: { type: String, required: true, unique: true },
  platform: { type: String, required: true },
  tags: { type: [String], default: [] },
});

const Game = mongoose.model("Game", gameSchema);

export default Game;
