import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { PersonalAdmin } from "./PersonalAdmin"
import "../../sidepanel/styles.css"
import "./personal.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode><PersonalAdmin /></StrictMode>,
)
