import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/features/auth/useAuth";
import { ThemeProvider, usePrefs } from "./theme";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 15_000 } } });

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          {children}
          <ThemedToaster />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
    </ThemeProvider>
  );
}

function ThemedToaster() {
  const { resolved } = usePrefs();
  return <Toaster position="top-right" theme={resolved} offset={16} toastOptions={{ classNames: { toast: "!rounded-xl !border !border-border !bg-surface !text-text !shadow-lg !text-sm" } }} />;
}
