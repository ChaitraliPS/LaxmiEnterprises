/**
 * Higher-order function to catch asynchronous errors in route handlers
 * and forward them cleanly to the Express error middleware.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};
