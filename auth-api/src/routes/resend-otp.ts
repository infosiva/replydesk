import { Router, Request, Response } from 'express';
import { stmts, UserRow } from '../db';
import { sendOtpEmail } from '../email';

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const OTP_TTL_MS = 10 * 60 * 1000;

const router = Router();

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email?: string };

  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Email is required', field: 'email' });
    return;
  }

  const normalEmail = email.toLowerCase().trim();

  const user = stmts.findByEmail.get(normalEmail) as UserRow | undefined;
  if (!user) {
    // Don't leak whether email exists — just return ok
    res.status(200).json({ sent: true });
    return;
  }

  if (user.email_verified) {
    res.status(400).json({ error: 'Email already verified' });
    return;
  }

  const code = generateOtp();
  const expiresAt = Date.now() + OTP_TTL_MS;
  stmts.insertOtp.run(normalEmail, code, expiresAt);

  try {
    await sendOtpEmail(normalEmail, code, user.site);
  } catch (err) {
    console.error('Failed to send OTP email:', err);
  }

  res.status(200).json({ sent: true });
});

export default router;
