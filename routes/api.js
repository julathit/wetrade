import express from "express";

import authRoutes from './auth.js';
import userRoutes from './user.js';
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authRoutes);
router.use('/user', verifyToken(false), userRoutes);

export default router;