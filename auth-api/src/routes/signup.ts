import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { stmts, toPublicUser, UserRow } from '../db';
import { signToken } from '../auth';
import { validateUsername, validatePassword } from '../validate';
import { sendOtpEmail } from '../email';

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

const router = Router();

const VALID_SITES = new Set(['kwizzo', 'tutiq', 'quizbites', 'quizbytes']);

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { username, email, password, site } = req.body as {
    username?: string;
    email?: string;
    password?: string;
    site?: string;
  };

  // Basic presence checks
  if (!username || typeof username !== 'string') {
    res.status(400).json({ error: 'Username is required', field: 'username' });
    return;
  }
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Email is required', field: 'email' });
    return;
  }
  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'Password is required', field: 'password' });
    return;
  }
  if (!site || typeof site !== 'string') {
    res.status(400).json({ error: 'Site is required', field: 'site' });
    return;
  }

  // Normalise
  const normalUsername = username.toLowerCase().trim();
  const normalEmail = email.toLowerCase().trim();
  const normalSite = site.toLowerCase().trim();

  // Validate site (soft — allow unknown but record it)
  if (!VALID_SITES.has(normalSite)) {
    res.status(400).json({ error: 'Invalid site identifier', field: 'site' });
    return;
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalEmail)) {
    res.status(400).json({ error: 'Invalid email address', field: 'email' });
    return;
  }

  // Validate username
  const usernameCheck = validateUsername(normalUsername);
  if (!usernameCheck.valid) {
    res.status(400).json({ error: usernameCheck.error, field: 'username' });
    return;
  }

  // Validate password
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    res.status(400).json({ error: passwordCheck.errors[0], field: 'password' });
    return;
  }

  // Check username uniqueness (case-insensitive — stored lowercased)
  const existingUsername = stmts.usernameExists.get(normalUsername) as { id: number } | undefined;
  if (existingUsername) {
    res.status(400).json({ error: 'Username is already taken', field: 'username' });
    return;
  }

  // Check email uniqueness
  const existingEmail = stmts.emailExists.get(normalEmail) as { id: number } | undefined;
  if (existingEmail) {
    res.status(400).json({ error: 'An account with this email already exists', field: 'email' });
    return;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Insert user
  let userId: number;
  try {
    const result = stmts.insertUser.run(normalUsername, normalEmail, passwordHash, normalSite);
    userId = result.lastInsertRowid as number;
  } catch (err: unknown) {
    // Race condition — unique constraint hit between check and insert
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('UNIQUE constraint failed: users.username')) {
      res.status(400).json({ error: 'Username is already taken', field: 'username' });
    } else if (msg.includes('UNIQUE constraint failed: users.email')) {
      res.status(400).json({ error: 'An account with this email already exists', field: 'email' });
    } else {
      console.error('Signup DB error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
    return;
  }

  // Generate + store OTP
  const code = generateOtp();
  const expiresAt = Date.now() + OTP_TTL_MS;
  stmts.insertOtp.run(normalEmail, code, expiresAt);

  // Send OTP email
  try {
    await sendOtpEmail(normalEmail, code, normalSite);
  } catch (err) {
    console.error('Failed to send OTP email:', err);
    // Don't block signup — still return success, user can request resend
  }

  res.status(200).json({ otpSent: true, email: normalEmail });
});

export default router;
