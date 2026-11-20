/**
 * Cloudflare Worker entry point (wrangler.jsonc "main"). Only the default handler is exported:
 * workerd treats every named export of this module as an entrypoint. Logic: worker/proxy.ts.
 */
import { handleApiRequest, type Env } from './proxy.ts'

export default {
  fetch: (request: Request, env: Env) => handleApiRequest(request, env),
}
