"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../auth");
const router = (0, express_1.Router)();
router.get('/', (req, res) => {
    const token = (0, auth_1.extractBearerToken)(req.headers.authorization);
    if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    let payload;
    try {
        payload = (0, auth_1.verifyToken)(token);
    }
    catch {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const user = db_1.stmts.findById.get(payload.userId);
    if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    res.status(200).json({ user: (0, db_1.toPublicUser)(user) });
});
exports.default = router;
