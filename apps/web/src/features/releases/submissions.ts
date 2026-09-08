import {
  releaseSubmissionsSchema,
  type ReleaseManifest,
  type ReleaseSubmissions,
} from "@llang-gap/contracts";
import snapshot from "@results/submissions.json";

export function getReleaseSubmitters(
  releases: readonly Pick<ReleaseManifest, "id">[],
): ReleaseSubmissions["releases"] {
  const submissions = releaseSubmissionsSchema.parse(snapshot);
  return Object.fromEntries(
    releases.flatMap(({ id }) =>
      Object.hasOwn(submissions.releases, id) ? [[id, submissions.releases[id]!]] : [],
    ),
  );
}
