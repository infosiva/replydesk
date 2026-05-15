"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("../db");
const auth_1 = require("../auth");
const router = (0, express_1.Router)();
router.post('/', async (req, res) => {
    const { email, password } = req.body;
    if (!email || typeof email !== 'string') {
        res.status(400).json({ error: 'Email is required', field: 'email' });
        return;
    }
    if (!password || typeof password !== 'string') {
        res.status(400).json({ error: 'Password is required', field: 'password' });
        return;
    }
    const normalEmail = email.toLowerCase().trim();
    const user = db_1.stmts.findByEmail.get(normalEmail);
    if (!user) {
        // Use constant-time compare even for missing users to prevent timing attacks
        await bcryptjs_1.default.compare(password, '$2a$12$invalidhashpaddingtopreventitimingleak000000000000000000');
        res.status(401).json({ error: 'Invalid email or password' });
        return;
    }
    const passwordMatch = await bcryptjs_1.default.compare(password, user.password_hash);
    if (!passwordMatch) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
    }
    // Update last_login
    db_1.stmts.updateLastLogin.run(user.id);
    const token = (0, auth_1.signToken)({ userId: user.id, username: user.username, email: user.email, site: user.site });
    res.status(200).json({ token, user: (0, db_1.toPublicUser)(user) });
});
exports.default = router;
