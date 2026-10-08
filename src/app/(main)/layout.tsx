import { AuthProvider } from "@/components/auth/AuthProvider";
import { AppShell } from "@/components/shell/AppShell";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
