/**
 * Response Helpers
 * Standard response formatters for Azure Functions HTTP responses
 */

import { HttpResponseInit } from "@azure/functions";
import { ApiResponse } from "../types";

/**
 * Get CORS headers for responses
 */
const getCorsHeaders = () => ({
    'Access-Control-Allow-Origin': 'http://127.0.0.1:3000',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
});

/**
 * Create a success response
 * @param data - Response data
 * @param statusCode - HTTP status code (default: 200)
 * @returns HttpResponseInit
 */
export const successResponse = <T = any>(
    data: T,
    statusCode: number = 200
): HttpResponseInit => {
    const response: ApiResponse<T> = {
        success: true,
        data,
        meta: {
            timestamp: new Date().toISOString(),
            request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
    };

    return {
        status: statusCode,
        headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders()
        },
        body: JSON.stringify(response)
    };
};

/**
 * Create an error response
 * @param message - Error message
 * @param statusCode - HTTP status code (default: 400)
 * @param details - Additional error details (optional)
 * @returns HttpResponseInit
 */
export const errorResponse = (
    message: string,
    statusCode: number = 400,
    details?: any
): HttpResponseInit => {
    const response: ApiResponse = {
        success: false,
        error: {
            code: 'ERROR',
            message,
            ...(details && { details })
        },
        meta: {
            timestamp: new Date().toISOString(),
            request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
    };

    return {
        status: statusCode,
        headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders()
        },
        body: JSON.stringify(response)
    };
};

/**
 * Create an unauthorized response (401)
 * @param message - Error message (default: 'Unauthorized')
 * @returns HttpResponseInit
 */
export const unauthorizedResponse = (
    message: string = 'Unauthorized'
): HttpResponseInit => {
    return errorResponse(message, 401);
};

/**
 * Create a forbidden response (403)
 * @param message - Error message (default: 'Forbidden')
 * @returns HttpResponseInit
 */
export const forbiddenResponse = (
    message: string = 'Forbidden'
): HttpResponseInit => {
    return errorResponse(message, 403);
};

/**
 * Create a not found response (404)
 * @param message - Error message (default: 'Not found')
 * @returns HttpResponseInit
 */
export const notFoundResponse = (
    message: string = 'Not found'
): HttpResponseInit => {
    return errorResponse(message, 404);
};

/**
 * Create a validation error response (400)
 * @param errors - Array of validation error messages
 * @returns HttpResponseInit
 */
export const validationErrorResponse = (
    errors: string[]
): HttpResponseInit => {
    return errorResponse('Validation failed', 400, { errors });
};

/**
 * Create a conflict response (409)
 * @param message - Error message
 * @returns HttpResponseInit
 */
export const conflictResponse = (
    message: string
): HttpResponseInit => {
    return errorResponse(message, 409);
};

/**
 * Create an internal server error response (500)
 * @param message - Error message (default: 'Internal server error')
 * @returns HttpResponseInit
 */
export const internalServerErrorResponse = (
    message: string = 'Internal server error'
): HttpResponseInit => {
    return errorResponse(message, 500);
};

// Made with Bob
