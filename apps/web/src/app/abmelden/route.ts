import { logout } from '@click-bot/db';
import { clearSessionCookie, sessionToken } from '@/server/auth';
import { getDb } from '@/server/db';

/**
 * Logout from the button in the sidebar (a POST form). The SameSite=Lax cookie is not sent with
 * POST requests from other sites, so no other page can log anyone out.
 */
export async function POST(request: Request): Promise<Response> {
  const token = await sessionToken();
  if (token) await logout(getDb(), token);
  await clearSessionCookie();
  return Response.redirect(new URL('/anmelden', request.url), 303);
}
