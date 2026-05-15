import { Router, Request, Response } from 'express';
import { stmts } from '../db';
import { validateUsername } from '../validate';

const router = Router();

router.get('/', (req: Request, res: Response): void => {
  const raw = req.query.username;

  if (!raw || typeof raw !== 'string') {
    res.status(400).json({ available: false, valid: false, error: 'username query parameter is required' });
    return;
  }

  const username = raw.toLowerCase().trim();
  const validation = validateUsername(username);

  if (!validation.valid) {
    res.status(200).json({ available: false, valid: false, error: validation.error });
    return;
  }

  const existing = stmts.usernameExists.get(username) as { id: number } | undefined;
  const available = !existing;

  res.status(200).json({ available, valid: true });
});

export default router;
