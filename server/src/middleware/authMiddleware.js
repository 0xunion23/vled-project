import { getUserByToken } from '../services/authService.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const user = await getUserByToken(token);
    if (!user) {
      return res.status(401).json({ message: 'Invalid or expired session.' });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
