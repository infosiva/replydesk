import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Import routes
import signupRouter from './routes/signup';
import loginRouter from './routes/login';
import meRouter from './routes/me';
import checkRouter from './routes/check';
import verifyOtpRouter from './routes/verify-otp';
import resendOtpRouter from './routes/resend-otp';
import guestRouter from './routes/guest';

const app = express();
const PORT = parseInt(process.env.PORT || '3110', 10);

// CORS
const ALLOWED_ORIGINS = [
  'https://kwizzo.app',
  'https://tutiq.app',
  'https://quizbites.app',
  'https://quizbytes.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10kb' }));

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  skip: (req) => process.env.NODE_ENV === 'test',
});

// Routes
app.use('/signup', authLimiter, signupRouter);
app.use('/login', authLimiter, loginRouter);
app.use('/verify-otp', authLimiter, verifyOtpRouter);
app.use('/resend-otp', authLimiter, resendOtpRouter);
app.use('/me', meRouter);
app.use('/check', checkRouter);
app.use('/guest', guestRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`auth-api listening on port ${PORT}`);
});

export default app;
