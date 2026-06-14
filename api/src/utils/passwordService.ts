/**
 * Password Service
 * Handles password hashing, verification, and strength validation
 * Uses bcrypt for secure password hashing (12 rounds)
 */

import * as bcrypt from 'bcryptjs';
import { ValidationResult } from '../types';

// Number of salt rounds for bcrypt (12 is recommended for security/performance balance)
const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 * @param password - Plain text password
 * @returns Promise<string> - Hashed password
 */
export const hashPassword = async (password: string): Promise<string> => {
    try {
        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        return hash;
    } catch (error: any) {
        throw new Error(`Failed to hash password: ${error.message}`);
    }
};

/**
 * Verify a password against a hash
 * @param password - Plain text password to verify
 * @param hash - Hashed password to compare against
 * @returns Promise<boolean> - True if password matches, false otherwise
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
    try {
        const isMatch = await bcrypt.compare(password, hash);
        return isMatch;
    } catch (error: any) {
        throw new Error(`Failed to verify password: ${error.message}`);
    }
};

/**
 * Validate password strength
 * Requirements:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 * 
 * @param password - Password to validate
 * @returns ValidationResult - Object with valid flag and array of error messages
 */
export const validatePasswordStrength = (password: string): ValidationResult => {
    const errors: string[] = [];

    // Check minimum length
    if (password.length < 12) {
        errors.push('Password must be at least 12 characters long');
    }

    // Check for uppercase letter
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    // Check for lowercase letter
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }

    // Check for number
    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    // Check for special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

/**
 * Generate a random password that meets strength requirements
 * Useful for temporary passwords or password reset flows
 * 
 * @param length - Length of password (default: 16)
 * @returns string - Generated password
 */
export const generateSecurePassword = (length: number = 16): string => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const allChars = uppercase + lowercase + numbers + special;

    let password = '';

    // Ensure at least one character from each required category
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Fill the rest with random characters
    for (let i = password.length; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password to avoid predictable patterns
    return password.split('').sort(() => Math.random() - 0.5).join('');
};

// Made with Bob
