# Public URL checks

`SITE_URL` controls the public HTTPS origin; changing `.env.example` does not change deployment settings.
When moving domains, preserve paths, redirect the old origin, rebuild and check canonical/alternate URLs.
Preview `noindex` is not access control: never host private artifacts there.
Do not infer evaluation/publication dates from release creation or artifact licensing from the code license.

Unknown pages use Next.js `notFound()` and must return HTTP 404 with `noindex`,
without redirecting to the homepage. Check localized unknown paths, missing model
and release IDs, and paths with file extensions against a production build.
The recovery button must preserve the UI locale.

The locale root layout uses `setRequestLocale`; fallback documents share only the
site shell and must not call that setter. Next.js can render fallback boundaries
alongside a valid route, so setting a default locale there can change another
boundary's language. Keep valid pages statically generated. The pinned Next.js
version requires `experimental.globalNotFound` for routing-level misses outside
the locale layout; root `not-found` also handles invalid locale segments that
bypass the proxy.
