import { Response } from 'express';
export interface APIError {
    error: string;
    message?: string;
    code?: string;
    timestamp: string;
}
/**
 * Extract error message consistently from unknown error types
 */
export declare function getErrorMessage(error: unknown): string;
/**
 * Classify error type for appropriate handling
 */
export declare function classifyError(error: unknown): 'validation' | 'external_api' | 'system' | 'not_found';
/**
 * Create standardized API error response
 */
export declare function createAPIError(res: Response, status: number, error: string, originalError?: unknown, code?: string): void;
/**
 * Create validation error (400)
 */
export declare function createValidationError(res: Response, message: string): void;
/**
 * Create external API error (503)
 */
export declare function createExternalAPIError(res: Response, service: string, originalError: unknown): void;
/**
 * Create system error (500)
 */
export declare function createSystemError(res: Response, message: string, originalError?: unknown): void;
//# sourceMappingURL=errorUtils.d.ts.map