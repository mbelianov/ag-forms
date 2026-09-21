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

// Made with Bob
