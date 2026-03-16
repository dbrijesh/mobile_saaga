/**
 * Standard CORS headers for all API responses
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
};

/**
 * Create a successful response with CORS headers
 */
function successResponse(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body)
  };
}

/**
 * Create an error response with CORS headers
 */
function errorResponse(statusCode, message, details = null) {
  const body = { error: message };
  if (details) {
    body.details = details;
  }
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body)
  };
}

module.exports = {
  corsHeaders,
  successResponse,
  errorResponse
};
