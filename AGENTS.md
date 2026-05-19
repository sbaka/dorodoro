<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## UI components

Prefer shadcn/ui components whenever a suitable one exists — dialogs,
popovers, dropdown menus, toasts, sheets, tooltips, form primitives,
tabs, etc. Reach for `Dialog` / `Sheet` / `AlertDialog` instead of
hand-rolling modal markup, and install the component via the shadcn CLI
before using it rather than copying fragments by hand. Only fall back to
custom markup when no shadcn primitive fits.
