import { currentUser } from "./auth";

export async function requireUser() {
  const user = await currentUser();
  if (!user) return { user: null, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  return { user, response: null };
}
