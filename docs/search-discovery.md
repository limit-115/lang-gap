# Public URL checks

`SITE_URL` controls the public HTTPS origin; changing `.env.example` does not change deployment settings.
When moving domains, preserve paths, redirect the old origin, rebuild and check canonical/alternate URLs.
Preview `noindex` is not access control: never host private artifacts there.
Do not infer evaluation/publication dates from release creation or artifact licensing from the code license.
