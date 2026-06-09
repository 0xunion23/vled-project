import crypto from 'node:crypto';
import User from '../models/User.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 6;

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email
  };
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function validateAuthInput({ name, email, password }, mode) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = String(name || '').trim();
  const normalizedPassword = String(password || '');

  if (mode === 'register' && normalizedName.length < 2) {
    throw createHttpError('Name must be at least 2 characters.', 400);
  }

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw createHttpError('Enter a valid email address.', 400);
  }

  if (normalizedPassword.length < PASSWORD_MIN_LENGTH) {
    throw createHttpError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`, 400);
  }

  return {
    name: normalizedName,
    email: normalizedEmail,
    password: normalizedPassword
  };
}

async function issueToken(user) {
  const token = crypto.randomBytes(32).toString('hex');
  user.tokenHash = hashToken(token);
  user.lastLoginAt = new Date();
  await user.save();
  return token;
}

export async function registerUser(payload) {
  const { name, email, password } = validateAuthInput(payload, 'register');
  const passwordSalt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, passwordSalt);

  try {
    const user = await User.create({
      name,
      email,
      passwordSalt,
      passwordHash
    });

    const token = await issueToken(user);
    return { token, user: publicUser(user) };
  } catch (error) {
    if (error?.code === 11000) {
      throw createHttpError('An account with this email already exists.', 409);
    }
    throw error;
  }
}

export async function loginUser(payload) {
  const { email, password } = validateAuthInput(payload, 'login');
  const user = await User.findOne({ email });

  if (!user) {
    throw createHttpError('Invalid email or password.', 401);
  }

  const passwordHash = hashPassword(password, user.passwordSalt);
  const expected = Buffer.from(user.passwordHash, 'hex');
  const actual = Buffer.from(passwordHash, 'hex');

  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw createHttpError('Invalid email or password.', 401);
  }

  const token = await issueToken(user);
  return { token, user: publicUser(user) };
}

export async function getUserByToken(token) {
  const rawToken = String(token || '').trim();
  if (!rawToken) return null;

  const user = await User.findOne({ tokenHash: hashToken(rawToken) });
  return user;
}

export async function logoutUser(user) {
  user.tokenHash = null;
  await user.save();
}

export { publicUser };
