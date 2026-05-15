"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const validate_1 = require("../validate");
const router = (0, express_1.Router)();
router.get('/', (req, res) => {
    const raw = req.query.username;
    if (!raw || typeof raw !== 'string') {
        res.status(400).json({ available: false, valid: false, error: 'username query parameter is required' });
        return;
    }
    const username = raw.toLowerCase().trim();
    const validation = (0, validate_1.validateUsername)(username);
    if (!validation.valid) {
        res.status(200).json({ available: false, valid: false, error: validation.error });
        return;
    }
    const existing = db_1.stmts.usernameExists.get(username);
    const available = !existing;
    res.status(200).json({ available, valid: true });
});
exports.default = router;
