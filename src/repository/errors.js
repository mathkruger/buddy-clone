export class DuplicateUsernameError extends Error {
  constructor(message) {
    super(message);
    this.code = "DuplicateUsernameError";
  }
}
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.code = "ValidationError";
  }
}
export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.code = "NotFoundError";
  }
}
export class TokenMismatchError extends Error {
  constructor(message) {
    super(message);
    this.code = "TokenMismatchError";
  }
}