import { describe, expect, it } from "vitest";
import { isCurrentPage } from "./is-current-page";

describe("header current page", () => {
  it.each(["/", "/methodology", "/methodology/", "/releases", "/releases/"])(
    "marks exactly one navigation destination for %s",
    (pathname) => {
      const destinations = ["/", "/methodology", "/releases"];
      expect(destinations.filter((href) => isCurrentPage(pathname, href))).toEqual([
        pathname.replace(/\/$/, "") || "/",
      ]);
    },
  );

  it.each(["/methodology/details/", "/releases-archive/"])(
    "does not mark a different page for %s",
    (pathname) => {
      expect(["/", "/methodology", "/releases"].some((href) => isCurrentPage(pathname, href))).toBe(
        false,
      );
    },
  );
});
