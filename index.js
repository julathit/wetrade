import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";

import { verifyToken } from './middleware/authMiddleware.js';
import apiRoutes from "./routes/api.js";
import { loadFetchModule } from "./utils.js";

await loadFetchModule();

const __dirname = path.resolve();

const app = express();

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
});

app.get('/', verifyToken(true, '/login'), (req, res) => {
  if (!req.user) {
    res.redirect(302, '/login');
  } else {
    console.log("✅ going to dashboard");
    res.redirect(302, '/dashboard');
  }
})

app.use("/login", verifyToken(true, '/dashboard', 0), express.static(path.join(__dirname, "auth")));

app.use("/dashboard", verifyToken(true, '/login', 1), express.static(path.join(__dirname, "public")));

app.use("/api", apiRoutes);

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
