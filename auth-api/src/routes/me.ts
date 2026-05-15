import { Router, Request, Response } from 'express';
import { stmts, toPublicUser, UserRow } from '../db';
import { verifyToken, extractBearerToken } from '../auth';

const router = Router();

router.get('/', (req: Request, res: Response): void => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const user = stmts.findById.get(payload.userId) as UserRow | undefined;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  res.status(200).json({ user: toPublicUser(user) });
});

export default router;
