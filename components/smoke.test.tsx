import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { cn } from "@/lib/utils"

describe("smoke test", () => {
  it("renderiza um componente trivial", () => {
    render(<button>Enviar</button>)
    expect(screen.getByRole("button", { name: "Enviar" })).toBeInTheDocument()
  })

  it("resolve o alias @/ e usa cn()", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })
})
