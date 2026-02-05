export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (code, message) => new HttpError(400, code, message);
export const unauthorized = (code, message) => new HttpError(401, code, message);
export const forbidden = (code, message) => new HttpError(403, code, message);
export const notFound = (code, message) => new HttpError(404, code, message);

