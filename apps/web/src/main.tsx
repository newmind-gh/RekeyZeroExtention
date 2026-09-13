import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createBrowserRouter, RouterProvider } from "react-router"

import App from "@/App"
import { ConfigurationPage } from "@/pages/configuration"
import { RecordDetailPage } from "@/pages/record-detail"
import { RecordsPage } from "@/pages/records"
import { CorrectionsPage } from "@/pages/corrections"
import { PerformancePage } from "@/pages/performance"
import { UseCaseDetailPage } from "@/pages/use-case-detail"
import { UseCasesPage } from "@/pages/use-cases"
import "@/index.css"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5_000, retry: 1 },
  },
})

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <RecordsPage /> },
      { path: "records/:recordId", element: <RecordDetailPage /> },
      { path: "configuration", element: <ConfigurationPage /> },
      { path: "use-cases", element: <UseCasesPage /> },
      { path: "use-cases/:useCaseId", element: <UseCaseDetailPage /> },
      { path: "performance", element: <PerformancePage /> },
      { path: "corrections", element: <CorrectionsPage /> },
    ],
  },
])

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
