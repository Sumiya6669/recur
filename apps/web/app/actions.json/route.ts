export const dynamic = "force-static";

const headers = { "access-control-allow-origin": "*", "content-type": "application/json" };

/** Maps checkout links to Solana Actions so X/Twitter renders them as Blinks. */
export function GET() {
  return new Response(
    JSON.stringify({ rules: [{ pathPattern: "/pay/*", apiPath: "/api/actions/subscribe/*" }] }),
    { headers },
  );
}
export const OPTIONS = () => new Response(null, { headers });
