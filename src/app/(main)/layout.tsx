import { AuthProvider } from "@/components/auth/AuthProvider";
import { AppShell } from "@/components/shell/AppShell";
import { pageActor } from "@/lib/auth/server";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const me = await pageActor();
  const store = await getStore();
  return (
    <AuthProvider me={me} storeKind={store.kind}>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
