import express from 'express';
import { loginUser, logoutUser, publicUser, registerUser } from '../services/authService.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const authRouter = express.Router();

function sendAuthError(res, error) {
  const status = error.statusCode || 500;
  res.status(status).json({
    message: status >= 500 ? 'Authentication request failed.' : error.message
  });
}

authRouter.post('/register', async (req, res) => {
  try {
    const result = await registerUser(req.body || {});
    res.status(201).json(result);
  } catch (error) {
    sendAuthError(res, error);
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const result = await loginUser(req.body || {});
    res.json(result);
  } catch (error) {
    sendAuthError(res, error);
  }
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await logoutUser(req.user);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
