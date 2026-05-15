import { Router, Request, Response } from 'express';
import { stmts, toPublicUser, UserRow } from '../db';
import { signToken } from '../auth';

const router = Router();

interface OtpRow {
  id: number;
  email: string;
  code: string;
  expires_at: number;
  used: number;
}

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { email, code } = req.body as { email?: string; code?: string };

  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Email is required', field: 'email' });
    return;
  }
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Code is required', field: 'code' });
    return;
  }

  const normalEmail = email.toLowerCase().trim();
  const normalCode = code.trim();

  // Find valid OTP
  const now = Date.now();
  const otp = stmts.findValidOtp.get(normalEmail, normalCode, now) as OtpRow | undefined;

  if (!otp) {
    res.status(400).json({ error: 'Invalid or expired code. Please request a new one.', field: 'code' });
    return;
  }

  // Mark OTP used
  stmts.markOtpUsed.run(otp.id);

  // Clean up old OTPs for this email
  stmts.deleteExpiredOtps.run(now);

  // Find user by email
  const user = stmts.findByEmail.get(normalEmail) as UserRow | undefined;
  if (!user) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  // Mark email verified
  stmts.verifyEmail.run(user.id);
  stmts.updateLastLogin.run(user.id);

  const token = signToken({
    userId: user.id,
    username: user.username,
    email: user.email,
    site: user.site,
  });

  res.status(200).json({ token, user: toPublicUser(user) });
});

export default router;
