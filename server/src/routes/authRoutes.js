import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { env } from '../config/env.js';

export const authRouter = express.Router();

// POST /api/auth/register
authRouter.post('/register', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }
    if (username.length < 3 || username.length > 32) {
      return res.status(400).json({ message: 'Username must be between 3 and 32 characters.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const existing = await User.findOne({ username: username.trim() });
    if (existing) {
      return res.status(409).json({ message: 'Username already taken.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username: username.trim(), passwordHash });

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      env.jwtSecret,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: { id: user._id, username: user.username, queriesRemaining: 20 }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      env.jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user._id, username: user.username, queriesRemaining: user.queriesRemaining() }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me — returns current user info including queries remaining
authRouter.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }

    const token = authHeader.slice(7);
    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch {
      return res.status(401).json({ message: 'Token invalid or expired.' });
    }

    const user = await User.findById(payload.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    res.json({
      user: { id: user._id, username: user.username, queriesRemaining: user.queriesRemaining() }
    });
  } catch (error) {
    next(error);
  }
});
