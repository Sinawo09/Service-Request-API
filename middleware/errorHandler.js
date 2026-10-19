function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const statusCode = error.statusCode || error.status || 500;
  const message = statusCode === 500 ? 'An unexpected server error occurred.' : error.message;
  if (statusCode >= 500) console.error(error);

  res.status(statusCode).json({
    success: false,
    message,
    ...(error.errors ? { errors: error.errors } : {})
  });
}

module.exports = errorHandler;