import { ErrorCode } from "../types/ErrorCode";
import { APIError, APIResponse, ExceptionResponse } from "../types/APITypes";

export function error(error: ErrorCode) {
    return {
        success: false,
        error
    } as APIError;
}

export function exception(requestBody: object, error: Error, context?: any) {
    return {
        requestBody,
        errorMessage: error.stack ?? "No error stack reported",
        context
    } as ExceptionResponse;
}

export function success(data?: any) {
    return {
        success: true,
        data
    } as APIResponse;
}

export default {
    success,
    error,
    exception
};
