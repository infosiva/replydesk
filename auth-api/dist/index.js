"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Import routes
const signup_1 = __importDefault(require("./routes/signup"));
const login_1 = __importDefault(require("./routes/login"));
const me_1 = __importDefault(require("./routes/me"));
const check_1 = __importDefault(require("./routes/check"));
const app = (0, express_1.default)();
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
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. curl, server-to-server)
        if (!origin)
            return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin))
            return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10kb' }));
// Rate limiters
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
    skip: (req) => process.env.NODE_ENV === 'test',
});
// Routes
app.use('/signup', authLimiter, signup_1.default);
app.use('/login', authLimiter, login_1.default);
app.use('/me', me_1.default);
app.use('/check', check_1.default);
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});
// 404
app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
});
// Global error handler
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
});
app.listen(PORT, () => {
    console.log(`auth-api listening on port ${PORT}`);
});
exports.default = app;
