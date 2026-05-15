import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { stmts, toPublicUser, UserRow } from '../db';
import { signToken } from '../auth';

const router = Router();

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as {
    email?: string;
    password?: string;
  };

  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Email is required', field: 'email' });
    return;
  }
  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'Password is required', field: 'password' });
    return;
  }

  const normalEmail = email.toLowerCase().trim();
  const user = stmts.findByEmail.get(normalEmail) as UserRow | undefined;

  if (!user) {
    // Use constant-time compare even for missing users to prevent timing attacks
    await bcrypt.compare(password, '$2a$12$invalidhashpaddingtopreventitimingleak000000000000000000');
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  // Update last_login
  stmts.updateLastLogin.run(user.id);

  const token = signToken({ userId: user.id, username: user.username, email: user.email, site: user.site });

  res.status(200).json({ token, user: toPublicUser(user) });
});

export default router;
