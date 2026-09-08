import type { ReleaseManifest } from "@llang-gap/contracts";

function escapeBibtex(value: string) {
  const escapes: Record<string, string> = {
    "\\": "\\textbackslash{}",
    "{": "\\{",
    "}": "\\}",
    "%": "\\%",
    "&": "\\&",
    _: "\\_",
    "#": "\\#",
    $: "\\$",
    "~": "\\textasciitilde{}",
    "^": "\\textasciicircum{}",
  };
  return value.replace(/[\\{}%&_#$~^]/g, (character) => escapes[character]!);
}

export function releaseBibtex(
  release: Pick<ReleaseManifest, "id" | "dataset" | "createdAt" | "protocol">,
  url: string,
) {
  return `@misc{llang-gap-${release.id},
  author = {{Limit 115}},
  title = {{${escapeBibtex(`Lang Gap: ${release.dataset}`)}}},
  year = {${new Date(release.createdAt).getUTCFullYear()}},
  howpublished = {Benchmark release},
  note = {${escapeBibtex(`Release ${release.id}. Created ${new Date(release.createdAt).toISOString().slice(0, 10)}. Protocol: ${release.protocol}.`)}},
  url = {${url}}
}`;
}
