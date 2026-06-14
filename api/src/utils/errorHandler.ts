/**
 * Error Handler
 * Centralized error handling for Azure Functions
 */

import { HttpResponseInit, InvocationContext } from "@azure/functions";
import { internalServerErrorResponse, errorResponse } from "./responseHelpers";

/**
 * Handle errors and return appropriate HTTP response
 * Logs detailed error information server-side but returns generic messages to clients
 * 
 * @param error - The error object
 * @param context - Azure Functions invocation context for logging
 * @returns HttpResponseInit with appropriate error response
 */
export const handleError = (
    error: Error | any,
    context: InvocationContext
): HttpResponseInit => {
    // Log detailed error server-side (without sensitive data)
    context.error('Error occurred:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        // Don't log sensitive data like passwords, tokens, etc.
    });

    // Map specific error types to appropriate status codes
    const errorMessage = error.message || 'An unexpected error occurred';

    // Handle specific error patterns
    if (errorMessage.includes('Entity not found')) {
        return errorResponse('Resource not found', 404);
    }

    if (errorMessage.includes('Entity already exists')) {
        return errorResponse('Resource already exists', 409);
    }

    if (errorMessage.includes('Concurrency conflict')) {
        return errorResponse('Resource was modified by another process. Please retry.', 409);
    }

    if (errorMessage.includes('Validation failed') || errorMessage.includes('Invalid')) {
        return errorResponse(errorMessage, 400);
    }

    if (errorMessage.includes('Unauthorized') || errorMessage.includes('Authentication')) {
        return errorResponse('Unauthorized', 401);
    }

    if (errorMessage.includes('Forbidden') || errorMessage.includes('Permission')) {
        return errorResponse('Forbidden', 403);
    }

    // Handle Azure Table Storage specific errors
    if (error.statusCode) {
        switch (error.statusCode) {
            case 400:
                return errorResponse('Bad request', 400);
            case 401:
                return errorResponse('Unauthorized', 401);
            case 403:
                return errorResponse('Forbidden', 403);
            case 404:
                return errorResponse('Resource not found', 404);
            case 409:
                return errorResponse('Conflict', 409);
            case 412:
                return errorResponse('Precondition failed', 412);
            case 429:
                return errorResponse('Too many requests', 429);
            case 500:
            case 503:
                return internalServerErrorResponse('Service temporarily unavailable');
            default:
                return internalServerErrorResponse();
        }
    }

    // Default to generic internal server error
    // Never expose internal error details to clients
    return internalServerErrorResponse('An unexpected error occurred');
};

/**
 * Wrap an async function with error handling
 * @param fn - Async function to wrap
 * @param context - Azure Functions invocation context
 * @returns Wrapped function that handles errors
 */
export const withErrorHandling = <T extends (...args: any[]) => Promise<HttpResponseInit>>(
    fn: T,
    context: InvocationContext
): ((...args: Parameters<T>) => Promise<HttpResponseInit>) => {
    return async (...args: Parameters<T>): Promise<HttpResponseInit> => {
        try {
            return await fn(...args);
        } catch (error) {
            return handleError(error, context);
        }
    };
};

/**
 * Custom error class for application-specific errors
 */
export class AppError extends Error {
    constructor(
        message: string,
        public statusCode: number = 500,
        public details?: any
    ) {
        super(message);
        this.name = 'AppError';
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Custom error class for validation errors
 */
export class ValidationError extends AppError {
    constructor(message: string, public errors: string[]) {
        super(message, 400, { errors });
        this.name = 'ValidationError';
    }
}

/**
 * Custom error class for authentication errors
 */
export class AuthenticationError extends AppError {
    constructor(message: string = 'Authentication failed') {
        super(message, 401);
        this.name = 'AuthenticationError';
    }
}

/**
 * Custom error class for authorization errors
 */
export class AuthorizationError extends AppError {
    constructor(message: string = 'Insufficient permissions') {
        super(message, 403);
        this.name = 'AuthorizationError';
    }
}

/**
 * Custom error class for not found errors
 */
export class NotFoundError extends AppError {
    constructor(message: string = 'Resource not found') {
        super(message, 404);
        this.name = 'NotFoundError';
    }
}

/**
 * Custom error class for conflict errors
 */
export class ConflictError extends AppError {
    constructor(message: string = 'Resource conflict') {
        super(message, 409);
        this.name = 'ConflictError';
    }
}

// Made with Bob
