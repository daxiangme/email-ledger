import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { LedgerApp } from "@/ledger-app"
import "./index.css"

const theme = window.matchMedia("(prefers-color-scheme: dark)")

function applyTheme() {
  const dark = theme.matches
  document.documentElement.classList.toggle("dark", dark)
  document.documentElement.style.colorScheme = dark ? "dark" : "light"
}

applyTheme()
theme.addEventListener("change", applyTheme)

const surface = document.body.dataset.surface === "page" ? "page" : "popup"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider delayDuration={400}>
      <LedgerApp surface={surface} />
      <Toaster />
    </TooltipProvider>
  </StrictMode>,
)
