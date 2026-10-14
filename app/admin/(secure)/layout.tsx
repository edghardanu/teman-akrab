import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminFrame } from "@/components/admin-frame";
import { getDb } from "@/lib/db";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { admins } from "@/lib/schema";
import { eq } from "drizzle-orm";

export default async function SecureAdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await readSession(token);
  if (!session) redirect("/admin/login");
  const [admin] = await getDb().select({ username: admins.username, mustChangePassword: admins.mustChangePassword }).from(admins).where(eq(admins.id, session.id)).limit(1);
  if (!admin) redirect("/admin/login");
  return <AdminFrame username={admin.username} mustChangePassword={admin.mustChangePassword}>{children}</AdminFrame>;
}
