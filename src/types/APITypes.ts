import { ErrorCode } from "./ErrorCode"

export interface APIResponse {
    success: true,
    data: any
}

export interface APIError {
    success: false,
    error: ErrorCode
}

export interface ExceptionResponse {
    requestBody: object,
    errorMessage: string,
    context: any
}