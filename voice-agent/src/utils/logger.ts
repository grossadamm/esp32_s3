import { getErrorMessage } from './errorUtils.js';

/**
 * Log error with consistent formatting and context
 */
export function logError(context: string, error: unknown, details?: any): void {
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
export function logInfo(context: string, message: string, details?: any): void {
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
export function logWarning(context: string, message: string, details?: any): void {
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
export function logSuccess(context: string, message: string, details?: any): void {
  const timestamp = new Date().toISOString();
  
  let logMessage = `[${timestamp}] ✅ ${context}: ${message}`;
  
  if (details) {
    logMessage += ` | Details: ${JSON.stringify(details)}`;
  }
  
  console.log(logMessage);
} 