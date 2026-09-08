"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      // There is no ThemeProvider in this app — dark mode is the OS
      // preference, and sonner's "system" reads prefers-color-scheme too.
      theme="system"
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--primary-subtle)",
          "--normal-text": "var(--primary-subtle-foreground)",
          "--normal-border": "var(--primary-subtle-border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
          // sonner hardcodes a grey description colour (and a lighter one
          // under its "dark" theme); override both so it reads as the brand.
          description: "text-primary-subtle-foreground/75!",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
