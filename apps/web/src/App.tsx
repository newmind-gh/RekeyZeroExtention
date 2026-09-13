import { BarChart3, Database, Settings2, Workflow } from "lucide-react"
import { NavLink, Outlet } from "react-router"

import { cn } from "@/lib/utils"

const navigation = [
  { to: "/", label: "Workspace", icon: Database },
  { to: "/use-cases", label: "Use Cases", icon: Workflow },
  { to: "/performance", label: "Performance", icon: BarChart3 },
  { to: "/configuration", label: "Setup", icon: Settings2 },
]

export default function App() {
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-950">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-neutral-950 text-white">
              <Workflow className="size-5" />
            </div>
            <div>
              <div className="font-semibold">RekeyZero</div>
              <div className="text-xs text-neutral-500">Validated information, reused safely.</div>
            </div>
          </div>
          <nav className="flex gap-1 rounded-lg bg-neutral-100 p-1">
            {navigation.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-neutral-600",
                    isActive && "bg-white text-neutral-950 shadow-sm",
                  )
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
