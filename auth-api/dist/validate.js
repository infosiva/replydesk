"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUsername = validateUsername;
exports.validatePassword = validatePassword;
const RESERVED_USERNAMES = new Set([
    'admin', 'root', 'system', 'api', 'null', 'undefined',
    'support', 'help', 'mod', 'moderator', 'bot'
]);
function validateUsername(u) {
    const username = u.toLowerCase();
    if (username.length < 3 || username.length > 20) {
        return { valid: false, error: 'Username must be between 3 and 20 characters' };
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
        return { valid: false, error: 'Username can only contain lowercase letters, numbers, and underscores' };
    }
    if (username.startsWith('_') || username.endsWith('_')) {
        return { valid: false, error: 'Username cannot start or end with an underscore' };
    }
    if (username.includes('__')) {
        return { valid: false, error: 'Username cannot contain consecutive underscores' };
    }
    if (RESERVED_USERNAMES.has(username)) {
        return { valid: false, error: 'That username is reserved and cannot be used' };
    }
    return { valid: true };
}
function validatePassword(p) {
    const errors = [];
    if (p.length < 8) {
        errors.push('Password must be at least 8 characters');
    }
    if (p.length > 100) {
        errors.push('Password must not exceed 100 characters');
    }
    if (!/[A-Z]/.test(p)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[0-9]/.test(p)) {
        errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*]/.test(p)) {
        errors.push('Password must contain at least one special character (!@#$%^&*)');
    }
    return { valid: errors.length === 0, errors };
}
