import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

router.post('/track', (req: Request, res: Response): void => {
  const { fingerprint, ip, product, action } = req.body as { fingerprint?: string; ip?: string; product?: string; action?: string };
  if (!fingerprint || !product || !action) { res.status(400).json({ error: 'fingerprint, product, action required' }); return; }
  const resolvedIp = ip ?? req.ip ?? '';
  db.prepare('INSERT INTO guest_sessions (fingerprint,ip,last_seen) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(fingerprint) DO UPDATE SET last_seen=CURRENT_TIMESTAMP,ip=excluded.ip').run(fingerprint, resolvedIp);
  db.prepare('INSERT INTO guest_usage (fingerprint,product,action,count) VALUES (?,?,?,1) ON CONFLICT(fingerprint,product,action) DO UPDATE SET count=count+1').run(fingerprint, product, action);
  const row = db.prepare('SELECT count FROM guest_usage WHERE fingerprint=? AND product=? AND action=?').get(fingerprint, product, action) as { count: number } | undefined;
  res.json({ count: row?.count ?? 1 });
});

router.get('/usage', (req: Request, res: Response): void => {
  const { fingerprint, product, action } = req.query as { fingerprint?: string; product?: string; action?: string };
  if (!fingerprint || !product || !action) { res.status(400).json({ error: 'fingerprint, product, action required' }); return; }
  const row = db.prepare('SELECT count FROM guest_usage WHERE fingerprint=? AND product=? AND action=?').get(fingerprint, product, action) as { count: number } | undefined;
  res.json({ count: row?.count ?? 0 });
});

export default router;
