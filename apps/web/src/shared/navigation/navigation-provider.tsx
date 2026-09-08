"use client";

// The shell supplies its locale explicitly, including for 404s outside locale routing.
// A client boundary avoids the server provider's implicit request-config lookups.
export { NextIntlClientProvider as NavigationProvider } from "next-intl";
