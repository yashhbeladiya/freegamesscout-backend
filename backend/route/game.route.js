import express from 'express';
import { getGames, getEpicGames, getPrimeGames, getSteamGames, getSeachedGames, addGames } from '../controller/game.controller.js';

const router = express.Router();

router.get('/', getGames);
router.get('/epic', getEpicGames);
router.get('/steam', getSteamGames);
router.get('/prime', getPrimeGames);
router.get('/search', getSeachedGames);
router.post('/', addGames);

export default router;

