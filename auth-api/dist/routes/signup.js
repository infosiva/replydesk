"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("../db");
const auth_1 = require("../auth");
const validate_1 = require("../validate");
const router = (0, express_1.Router)();
const VALID_SITES = new Set(['kwizzo', 'tutiq', 'quizbites', 'quizbytes']);
router.post('/', async (req, res) => {
    const { username, email, password, site } = req.body;
    // Basic presence checks
    if (!username || typeof username !== 'string') {
        res.status(400).json({ error: 'Username is required', field: 'username' });
        return;
    }
    if (!email || typeof email !== 'string') {
        res.status(400).json({ error: 'Email is required', field: 'email' });
        return;
    }
    if (!password || typeof password !== 'string') {
        res.status(400).json({ error: 'Password is required', field: 'password' });
        return;
    }
    if (!site || typeof site !== 'string') {
        res.status(400).json({ error: 'Site is required', field: 'site' });
        return;
    }
    // Normalise
    const normalUsername = username.toLowerCase().trim();
    const normalEmail = email.toLowerCase().trim();
    const normalSite = site.toLowerCase().trim();
    // Validate site (soft — allow unknown but record it)
    if (!VALID_SITES.has(normalSite)) {
        res.status(400).json({ error: 'Invalid site identifier', field: 'site' });
        return;
    }
    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalEmail)) {
        res.status(400).json({ error: 'Invalid email address', field: 'email' });
        return;
    }
    // Validate username
    const usernameCheck = (0, validate_1.validateUsername)(normalUsername);
    if (!usernameCheck.valid) {
        res.status(400).json({ error: usernameCheck.error, field: 'username' });
        return;
    }
    // Validate password
    const passwordCheck = (0, validate_1.validatePassword)(password);
    if (!passwordCheck.valid) {
        res.status(400).json({ error: passwordCheck.errors[0], field: 'password' });
        return;
    }
    // Check username uniqueness (case-insensitive — stored lowercased)
    const existingUsername = db_1.stmts.usernameExists.get(normalUsername);
    if (existingUsername) {
        res.status(400).json({ error: 'Username is already taken', field: 'username' });
        return;
    }
    // Check email uniqueness
    const existingEmail = db_1.stmts.emailExists.get(normalEmail);
    if (existingEmail) {
        res.status(400).json({ error: 'An account with this email already exists', field: 'email' });
        return;
    }
    // Hash password
    const passwordHash = await bcryptjs_1.default.hash(password, 12);
    // Insert user
    let userId;
    try {
        const result = db_1.stmts.insertUser.run(normalUsername, normalEmail, passwordHash, normalSite);
        userId = result.lastInsertRowid;
    }
    catch (err) {
        // Race condition — unique constraint hit between check and insert
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('UNIQUE constraint failed: users.username')) {
            res.status(400).json({ error: 'Username is already taken', field: 'username' });
        }
        else if (msg.includes('UNIQUE constraint failed: users.email')) {
            res.status(400).json({ error: 'An account with this email already exists', field: 'email' });
        }
        else {
            console.error('Signup DB error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
        return;
    }
    // Fetch full row to get created_at
    const user = db_1.stmts.findById.get(userId);
    const token = (0, auth_1.signToken)({ userId: user.id, username: user.username, email: user.email, site: user.site });
    res.status(200).json({ token, user: (0, db_1.toPublicUser)(user) });
});
exports.default = router;
