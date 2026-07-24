const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/** Standard envelope response. HTTP status is always 200; `code` carries the
 *  business result. */
export function jsonResponse(
  data: unknown,
  code = 200,
  message = "success"
): Response {
  return Response.json(
    { code, message, data },
    { status: 200, headers: corsHeaders }
  );
}

/** 204 response for CORS preflight. */
export function corsResponse(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}
