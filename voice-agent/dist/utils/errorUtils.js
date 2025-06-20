/**
 * Extract error message consistently from unknown error types
 */
export function getErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'Unknown error';
}
/**
 * Classify error type for appropriate handling
 */
export function classifyError(error) {
    const message = getErrorMessage(error).toLowerCase();
    if (message.includes('missing') || message.includes('invalid') || message.includes('required')) {
        return 'validation';
    }
    if (message.includes('api') || message.includes('whisper') || message.includes('openai') || message.includes('claude')) {
        return 'external_api';
    }
    if (message.includes('not found') || message.includes('does not exist')) {
        return 'not_found';
    }
    return 'system';
}
/**
 * Create standardized API error response
 */
export function createAPIError(res, status, error, originalError, code) {
    const apiError = {
        error,
        timestamp: new Date().toISOString()
    };
    if (originalError) {
        apiError.message = getErrorMessage(originalError);
    }
    if (code) {
        apiError.code = code;
    }
    res.status(status).json(apiError);
}
/**
 * Create validation error (400)
 */
export function createValidationError(res, message) {
    createAPIError(res, 400, message, undefined, 'VALIDATION_ERROR');
}
/**
 * Create external API error (503)
 */
export function createExternalAPIError(res, service, originalError) {
    createAPIError(res, 503, `${service} service unavailable`, originalError, 'EXTERNAL_API_ERROR');
}
/**
 * Create system error (500)
 */
export function createSystemError(res, message, originalError) {
    const errorType = classifyError(originalError);
    const status = errorType === 'external_api' ? 503 : 500;
    const code = errorType === 'external_api' ? 'EXTERNAL_API_ERROR' : 'SYSTEM_ERROR';
    createAPIError(res, status, message, originalError, code);
}
//# sourceMappingURL=errorUtils.js.map