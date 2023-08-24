"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.success = exports.exception = exports.error = void 0;
function error(error) {
    return {
        success: false,
        error
    };
}
exports.error = error;
function exception(requestBody, error, context) {
    return {
        requestBody,
        errorMessage: error.stack ?? "No error stack reported",
        context
    };
}
exports.exception = exception;
function success(data) {
    return {
        success: true,
        data
    };
}
exports.success = success;
exports.default = {
    success,
    error,
    exception
};
//# sourceMappingURL=HTTPService.js.map