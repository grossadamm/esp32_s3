import { getErrorMessage } from './errorUtils.js';
/**
 * Log error with consistent formatting and context
 */
export function logError(context, error, details) {
    const timestamp = new Date().toISOString();
    const errorMessage = getErrorMessage(error);
    let logMessage = `[${timestamp}] ❌ ${context}: ${errorMessage}`;
    if (details) {
        logMessage += ` | Details: ${JSON.stringify(details)}`;
    }
    console.error(logMessage);
    // If it's an Error object, also log the stack trace for debugging
    if (error instanceof Error && error.stack) {
        console.error(`[${timestamp}] Stack trace:`, error.stack);
    }
}
/**
 * Log info with consistent formatting and context
 */
export function logInfo(context, message, details) {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] ℹ️  ${context}: ${message}`;
    if (details) {
        logMessage += ` | Details: ${JSON.stringify(details)}`;
    }
    console.log(logMessage);
}
/**
 * Log warning with consistent formatting and context
 */
export function logWarning(context, message, details) {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] ⚠️  ${context}: ${message}`;
    if (details) {
        logMessage += ` | Details: ${JSON.stringify(details)}`;
    }
    console.warn(logMessage);
}
/**
 * Log success with consistent formatting and context
 */
export function logSuccess(context, message, details) {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] ✅ ${context}: ${message}`;
    if (details) {
        logMessage += ` | Details: ${JSON.stringify(details)}`;
    }
    console.log(logMessage);
}
//# sourceMappingURL=logger.js.map