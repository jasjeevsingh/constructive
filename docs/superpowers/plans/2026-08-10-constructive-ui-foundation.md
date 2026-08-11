# Constructive — Design-System Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the production styling stack (Tailwind + shadcn/ui) with a light-first warm brand theme and `next/font`, build owned base UI primitives, and prove the system by fully re-skinning the password Gate — all while keeping the app and its tests green.

**Architecture:** Add Tailwind v3 + PostCSS + a themed set of shadcn/ui primitives we own in `components/ui/`. Brand tokens live as CSS variables in `app/globals.css` and are mapped into Tailwind's theme; legacy brand CSS vars stay so not-yet-migrated inline-styled screens keep rendering. Fonts (Fraunces + DM Sans) load via `next/font/google`. The Gate is rewritten on the new primitives as the first migrated screen.

**Tech Stack:** Next.js 14 (App Router, TS strict), React 18, Tailwind CSS 3.4, shadcn/ui primitives (Radix + class-variance-authority + clsx + tailwind-merge), `next/font`, Vitest + React Testing Library + jsdom.

## Global Constraints

- **Light-first** theme; no dark mode this cycle. Warm paper `#FAF9F6` bg, deep navy ink `#0F1E2E` text.
- Fonts: **Fraunces** (display) + **DM Sans** (body) via `next/font/google`; Bebas Neue and the Google `<link>` are removed.
- Tailwind **v3.4** + shadcn/ui; primitives are **owned source** in `components/ui/`.
- **Keep the legacy brand CSS variables** (`--navy`,`--navy-mid`,`--navy-light`,`--gold`,`--orange`,`--orange-light`,`--paper`,`--ink`,`--dim`,`--text`) and the `.serif`/`.accent` helpers in `globals.css` so un-migrated inline-styled components render unchanged.
- Semantic accent tokens: **`evidence` = gold `#C8962E`**, **`reasoning` = orange `#F4732A`** (kept from the Link activity), plus `primary` brand blue `#1E5AA8`, `success` `#2E9E5B`, `destructive` `#DC2626`, `--radius` `0.75rem`.
- The Gate's behavior is unchanged: POST `{password}` to `/api/auth` → redirect to `/` on ok, inline error on failure, fetch wrapped in try/catch. Preserve an accessible "Constructive" heading, a labelled password input, an "Enter" button, and the error text.
- Test compatibility: **mock `next/font/google` in `vitest.setup.ts`** and set **`test.css: false`** in `vitest.config.ts` so the suite stays green.
- Every task ends green: `npm test` (full suite), `npx tsc --noEmit` (0 errors), `npm run build` (succeeds).
- Only the Gate changes visually this cycle; no behavior/state/coach/content/routing/API changes.

## File Structure

```
tailwind.config.ts          # Create — theme maps CSS vars → Tailwind colors/fonts/radius (Task 1)
postcss.config.mjs          # Create — tailwindcss + autoprefixer (Task 1)
components.json             # Create — shadcn config (for future `shadcn add`) (Task 1)
lib/utils.ts               # Create — cn() (clsx + tailwind-merge) (Task 1)
app/globals.css            # Modify — @tailwind layers + theme vars + kept legacy vars (Task 1)
app/layout.tsx             # Modify — next/font (Fraunces + DM Sans); drop Google <link> (Task 1)
vitest.setup.ts            # Modify — mock next/font/google (Task 1)
vitest.config.ts           # Modify — css: false (Task 1)
components/ui/button.tsx   # Create (Task 2)
components/ui/card.tsx     # Create (Task 2)
components/ui/input.tsx    # Create (Task 2)
components/ui/label.tsx    # Create (Task 2)
components/ui/badge.tsx    # Create (Task 2)
components/ui/progress.tsx # Create (Task 2)
tests/components/ui/button.test.tsx  # Create (Task 2)
components/Gate.tsx        # Modify — re-skin on primitives (Task 3)
tests/components/Gate.test.tsx        # Create (Task 3)
```

---

### Task 1: Tailwind + theme + fonts scaffolding

**Files:**
- Create: `tailwind.config.ts`, `postcss.config.mjs`, `components.json`, `lib/utils.ts`
- Modify: `app/globals.css`, `app/layout.tsx`, `vitest.setup.ts`, `vitest.config.ts`, `package.json`

**Interfaces:**
- Produces: Tailwind theme colors (`bg-background`, `text-foreground`, `bg-primary`, `text-evidence`, `text-reasoning`, `border-border`, `ring-ring`, …), `font-sans`/`font-display`, `rounded-lg`(=--radius); `cn(...)` from `@/lib/utils`.

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install class-variance-authority clsx tailwind-merge @radix-ui/react-slot @radix-ui/react-label @radix-ui/react-progress
npm install -D tailwindcss@^3.4.0 postcss@^8.4.0 autoprefixer@^10.4.0 tailwindcss-animate@^1.0.7
```
Expected: installs succeed; `package.json` gains these deps.

- [ ] **Step 2: Create `lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Create `postcss.config.mjs`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 4: Create `tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1120px" } },
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)" },
        secondary: { DEFAULT: "var(--secondary)", foreground: "var(--secondary-foreground)" },
        destructive: { DEFAULT: "var(--destructive)", foreground: "var(--destructive-foreground)" },
        muted: { DEFAULT: "var(--muted)", foreground: "var(--muted-foreground)" },
        accent: { DEFAULT: "var(--accent)", foreground: "var(--accent-foreground)" },
        popover: { DEFAULT: "var(--popover)", foreground: "var(--popover-foreground)" },
        card: { DEFAULT: "var(--card)", foreground: "var(--card-foreground)" },
        evidence: { DEFAULT: "var(--evidence)", foreground: "var(--evidence-foreground)" },
        reasoning: { DEFAULT: "var(--reasoning)", foreground: "var(--reasoning-foreground)" },
        success: { DEFAULT: "var(--success)", foreground: "var(--success-foreground)" },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: { "accordion-down": "accordion-down 0.2s ease-out", "accordion-up": "accordion-up 0.2s ease-out" },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
```

- [ ] **Step 5: Create `components.json`** (lets a future `npx shadcn add X` drop files in the right place)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui" }
}
```

- [ ] **Step 6: Replace `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: #FAF9F6;
    --foreground: #0F1E2E;
    --card: #FFFFFF;
    --card-foreground: #0F1E2E;
    --popover: #FFFFFF;
    --popover-foreground: #0F1E2E;
    --primary: #1E5AA8;
    --primary-foreground: #FFFFFF;
    --secondary: #F1EEE8;
    --secondary-foreground: #0F1E2E;
    --muted: #F1EEE8;
    --muted-foreground: #6B6156;
    --accent: #F1EEE8;
    --accent-foreground: #0F1E2E;
    --destructive: #DC2626;
    --destructive-foreground: #FFFFFF;
    --border: #E7E3DA;
    --input: #E7E3DA;
    --ring: #1E5AA8;
    --radius: 0.75rem;
    --evidence: #C8962E;
    --evidence-foreground: #1A1205;
    --reasoning: #F4732A;
    --reasoning-foreground: #1A0E05;
    --success: #2E9E5B;
    --success-foreground: #FFFFFF;

    /* Legacy brand vars — kept so not-yet-migrated inline-styled screens still render. */
    --navy: #0A1628;
    --navy-mid: #112240;
    --navy-light: #1B3461;
    --gold: #C8962E;
    --orange: #F4732A;
    --orange-light: #FF9A5C;
    --paper: #F7F6F2;
    --ink: #111E2B;
    --dim: #9AA5B4;
    --text: #E8E8E0;
  }

  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground font-sans antialiased;
  }
}

/* Legacy helper classes — kept for un-migrated components; now map to the new fonts. */
.serif {
  font-family: var(--font-display), Georgia, serif;
}
.accent {
  font-family: var(--font-sans), system-ui, sans-serif;
  letter-spacing: 1px;
  text-transform: uppercase;
}
```

- [ ] **Step 7: Replace `app/layout.tsx`** with `next/font`

```tsx
import "./globals.css";
import type { ReactNode } from "react";
import { Fraunces, DM_Sans } from "next/font/google";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});
const sans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata = {
  title: "Constructive",
  description: "Learn to build an argument — claim, link, and impact.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Update `vitest.setup.ts`** — add a `next/font/google` mock so tests importing the layout don't hit the build-time transform. Append:

```ts
import { vi } from "vitest";

vi.mock("next/font/google", () => ({
  Fraunces: () => ({ variable: "font-display", className: "font-display", style: { fontFamily: "Fraunces" } }),
  DM_Sans: () => ({ variable: "font-sans", className: "font-sans", style: { fontFamily: "DM Sans" } }),
}));
```

(Keep the existing `import "@testing-library/jest-dom/vitest";` line at the top.)

- [ ] **Step 9: Update `vitest.config.ts`** — disable CSS processing in tests so Tailwind's PostCSS doesn't run under Vitest. In the `test: { … }` object, add `css: false`:

```ts
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    css: false,
  },
```

(Leave the rest of the file — plugins, etc. — unchanged.)

- [ ] **Step 10: Verify the full suite, tsc, and build**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: full suite PASSES (the existing `tests/app/layout.test.tsx` still renders `RootLayout` — now with the mocked fonts — and passes; no test processes Tailwind CSS because `css: false`); tsc clean; `next build` succeeds and reports Tailwind compiled (routes unchanged).

- [ ] **Step 11: Commit**

```bash
git add tailwind.config.ts postcss.config.mjs components.json lib/utils.ts app/globals.css app/layout.tsx vitest.setup.ts vitest.config.ts package.json package-lock.json
git commit -m "feat: Tailwind + shadcn theme foundation, next/font (Fraunces + DM Sans)"
```

---

### Task 2: Base UI primitives (`components/ui/`)

**Files:**
- Create: `components/ui/button.tsx`, `components/ui/card.tsx`, `components/ui/input.tsx`, `components/ui/label.tsx`, `components/ui/badge.tsx`, `components/ui/progress.tsx`
- Test: `tests/components/ui/button.test.tsx`

**Interfaces:**
- Consumes: `cn` from `@/lib/utils` (Task 1); theme colors (Task 1).
- Produces: `Button`/`buttonVariants`, `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`, `Input`, `Label`, `Badge`/`badgeVariants` (with `evidence`/`reasoning` variants), `Progress`.

- [ ] **Step 1: Write the failing test** — `tests/components/ui/button.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders a real button with its accessible name", () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.className).toContain("bg-primary");
  });
  it("supports asChild to render a link styled as a button", () => {
    render(
      <Button asChild>
        <a href="/x">Go</a>
      </Button>
    );
    expect(screen.getByRole("link", { name: "Go" })).toHaveAttribute("href", "/x");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/ui/button.test.tsx`
Expected: FAIL — `@/components/ui/button` not found.

- [ ] **Step 3: Create `components/ui/button.tsx`**

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-input bg-background hover:bg-muted",
        ghost: "hover:bg-muted",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

- [ ] **Step 4: Create `components/ui/card.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...props} />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("font-display text-2xl font-semibold leading-tight tracking-tight", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
```

- [ ] **Step 5: Create `components/ui/input.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
```

- [ ] **Step 6: Create `components/ui/label.tsx`**

```tsx
"use client";
import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn("text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
```

- [ ] **Step 7: Create `components/ui/badge.tsx`**

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground",
        evidence: "border-transparent bg-evidence text-evidence-foreground",
        reasoning: "border-transparent bg-reasoning text-reasoning-foreground",
        success: "border-transparent bg-success text-success-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
```

- [ ] **Step 8: Create `components/ui/progress.tsx`**

```tsx
"use client";
import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
```

- [ ] **Step 9: Run the button test + tsc**

Run: `npm test -- tests/components/ui/button.test.tsx && npx tsc --noEmit`
Expected: PASS (both cases — real `<button>` with `bg-primary` in className, and `asChild` renders the `<a>`); tsc clean.

- [ ] **Step 10: Commit**

```bash
git add components/ui/button.tsx components/ui/card.tsx components/ui/input.tsx components/ui/label.tsx components/ui/badge.tsx components/ui/progress.tsx tests/components/ui/button.test.tsx
git commit -m "feat: owned shadcn base primitives (button/card/input/label/badge/progress)"
```

---

### Task 3: Re-skin the Gate on the new primitives

**Files:**
- Modify: `components/Gate.tsx`
- Test: `tests/components/Gate.test.tsx`

**Interfaces:**
- Consumes: `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`, `Input`, `Label`, `Button` (Task 2); `/api/auth` (stubbed in test).
- Produces: a themed, responsive, accessible Gate; behavior unchanged.

- [ ] **Step 1: Write the failing test** — `tests/components/Gate.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Gate } from "@/components/Gate";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
});

describe("Gate", () => {
  it("renders the branded gate with a labelled password field and Enter button", () => {
    render(<Gate />);
    expect(screen.getByText("Constructive")).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: /enter/i })).toBeInTheDocument();
  });

  it("submits the typed password to /api/auth", async () => {
    render(<Gate />);
    await userEvent.type(screen.getByLabelText(/password/i), "letmein");
    await userEvent.click(screen.getByRole("button", { name: /enter/i }));
    expect(fetch).toHaveBeenCalledWith("/api/auth", expect.objectContaining({ method: "POST" }));
  });

  it("shows an inline error when the password is rejected", async () => {
    render(<Gate />);
    await userEvent.type(screen.getByLabelText(/password/i), "nope");
    await userEvent.click(screen.getByRole("button", { name: /enter/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/didn.?t work/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/Gate.test.tsx`
Expected: FAIL — the current Gate has no labelled password field (no `<label>`), so `getByLabelText(/password/i)` throws, and there is no `role="alert"`.

- [ ] **Step 3: Rewrite `components/Gate.tsx`**

```tsx
"use client";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function Gate() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  async function submit() {
    setError(false);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = "/";
      } else {
        setError(true);
      }
    } catch (err) {
      console.error(err);
      setError(true);
    }
  }

  return (
    <main className="grid min-h-[100dvh] place-items-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">Constructive</CardTitle>
          <CardDescription>Enter the password from your retreat packet.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3 text-left"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                autoFocus
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                That password didn&apos;t work.
              </p>
            )}
            <Button type="submit" className="w-full">
              Enter
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 4: Run the Gate test + full suite + tsc + build**

Run: `npm test -- tests/components/Gate.test.tsx && npm test && npx tsc --noEmit && npm run build`
Expected: Gate test PASSES (all three cases); full suite PASSES; tsc clean; `next build` succeeds — the Gate route renders the themed markup with Tailwind styles.

- [ ] **Step 5: Commit**

```bash
git add components/Gate.tsx tests/components/Gate.test.tsx
git commit -m "feat: re-skin the Gate on the new design system (Card/Input/Label/Button)"
```

---

## Manual verification (after Task 3)

Not automated — do once with the app running (`npm run dev`):

1. Visiting any protected route redirects to the Gate: a centered white card on a warm off-white page, a **Fraunces** "Constructive" heading, a labelled password field, and a blue "Enter" button — responsive down to mobile.
2. Tab order and focus rings work; Enter submits; a wrong password shows the inline error; a correct one lands on the home page.
3. The rest of the app still renders (the flow screens keep their current dark inline-styled look on the new light body — expected until they're migrated in the next sub-projects).

---

## Self-Review

**Spec coverage:**
- Tailwind v3 + shadcn/ui stack, config files, `cn` → Task 1. ✓
- Light-first theme tokens (exact hex), `evidence`/`reasoning`/`primary`/`success` → Task 1 (globals.css + tailwind.config). ✓
- Fraunces + DM Sans via `next/font`, drop Google `<link>`/Bebas → Task 1. ✓
- Legacy CSS vars + `.serif`/`.accent` kept → Task 1 (globals.css). ✓
- Base primitives owned in `components/ui/` → Task 2. ✓
- Minimal layout shell (themed body; dedicated AppShell deferred) → Task 1 (layout.tsx). ✓
- Gate re-skin, behavior unchanged, accessible → Task 3. ✓
- Test compatibility: mock `next/font/google`, `css:false` → Task 1 (Steps 8–9). ✓
- Gates: suite green + tsc + build each task → Steps in Tasks 1/2/3. ✓
- Non-goals (no other screens, no behavior/routing changes, no dark mode) → respected. ✓

**Placeholder scan:** No TBD/TODO; every file's full contents are given. ✓

**Type consistency:** `cn` (Task 1) consumed by all primitives (Task 2) and Gate (Task 3); theme color keys (`primary`,`evidence`,`reasoning`,`background`,`border`,`ring`,`card`,`muted`,`destructive`,`success`) defined once in tailwind.config + globals.css and used consistently in the primitive classNames; `Button`/`Card*`/`Input`/`Label` exports match their Gate import sites; `next/font` variables `--font-display`/`--font-sans` map to Tailwind `font-display`/`font-sans` and the mock in vitest.setup mirrors the same shape. ✓
