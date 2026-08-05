export class AppError extends Error {
  public readonly statusCode: number;
  public readonly title: string;
  public readonly type: string;

  constructor(
    message: string,
    statusCode = 500,
    title = 'Internal Server Error',
    type = 'https://api.nstsdc.org/errors/internal-server-error'
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.title = title;
    this.type = type;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'Unauthorized', 'https://api.nstsdc.org/errors/unauthorized');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'Forbidden', 'https://api.nstsdc.org/errors/forbidden');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409, 'Conflict', 'https://api.nstsdc.org/errors/conflict');
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request') {
    super(message, 400, 'Bad Request', 'https://api.nstsdc.org/errors/bad-request');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not Found') {
    super(message, 404, 'Not Found', 'https://api.nstsdc.org/errors/not-found');
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = 'Unprocessable Entity') {
    super(
      message,
      422,
      'Unprocessable Entity',
      'https://api.nstsdc.org/errors/unprocessable-entity'
    );
  }
}

