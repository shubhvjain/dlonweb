/**
 * Server hooks for the SvelteKit application.
 * 
 * Sets security headers to enable cross-origin isolation, which is required
 * for using SharedArrayBuffer, WebAssembly threads, and other advanced browser APIs.
 */

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  const response = await resolve(event);
  // Enable cross-origin isolation by setting COOP and COEP headers 
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');

  return response;
}
