"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
exports.verifyToken = verifyToken;
exports.extractBearerToken = extractBearerToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-in-production-use-long-random-string';
const JWT_EXPIRY = '30d';
function signToken(payload) {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}
function verifyToken(token) {
    const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
    if (typeof decoded === 'string') {
        throw new Error('Invalid token payload');
    }
    return decoded;
}
function extractBearerToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer '))
        return null;
    const token = authHeader.slice(7).trim();
    return token.length > 0 ? token : null;
}
