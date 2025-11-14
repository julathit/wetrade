import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from 'dotenv';
import db from '../db.js';

dotenv.config();

const router = express.Router();

router.post("/register", async (req, res) => {
  if (!req.body) {
    return res.status(400).json({ message: "No data provided" });
  }

  if (Object.keys(req.body).length === 0) {
    return res.status(400).json({ message: "Empty data" });
  }

  const { username, email, password } = req.body;

  if (!username || !email || !password)
    return res.status(400).json({ message: "Missing fields, please provide username, email, and password" });

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username))
    return res.status(400).json({ message: "Invalid username" });

  if (!/^[\w.-]+@[\w.-]+\.\w+$/.test(email))
    return res.status(400).json({ message: "Invalid email" });

  if (password.length < 8)
    return res.status(400).json({ message: "Password too short" });

  // Check if user exists
  db.query("SELECT * FROM user WHERE email = ? OR username = ?", [email, username], async (err, result) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (result.length > 0)
      return res.status(409).json({ message: "Email or username already registered" });

    const hashed = await bcrypt.hash(password, 10);
    db.query(
      "INSERT INTO user (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashed],
      (err) => {
        if (err) return res.status(500).json({ message: "Registration failed", error: err });
        res.json({ message: "User registered successfully" });
      }
    );
  });
});

router.post("/login", (req, res) => {
  if (!req.body) {
    return res.status(400).json({ message: "No data provided" });
  }

  if (Object.keys(req.body).length === 0) {
    return res.status(400).json({ message: "Empty data" });
  }

  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: "Missing fields, please provide username and password" });

  db.query(
    "SELECT * FROM user WHERE username = ?",
    [username],
    async (err, results) => {
      if (err) return res.status(500).json({ message: "Server error"});
      if (results.length === 0)
        return res.status(401).json({ message: "Invalid credentials" });

      const user = results[0];
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ message: "Invalid credentials" });

      const token = jwt.sign(
        { username: user.username },
        process.env.JWT_SECRET || 'wetrade_default_secret',
        { expiresIn: '1h' } 
      );

      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        maxAge: 3600000
      });

      res.json({ message: "Login successful", username: user.username });
    }
  );
});

router.post("/logout", (req, res) => {
    res.clearCookie('token', {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict'
    });
    res.json({ message: "Logout successful" });
  });

export default router;