const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};


export function jsonResponse(data, code = 200, message = "success") {

  return Response.json(
    {
      code,
      message,
      data
    },
    {
      status: 200,
      headers: corsHeaders
    }
  );

}


export function corsResponse() {

  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });

}