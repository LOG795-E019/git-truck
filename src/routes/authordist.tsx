import type { LoaderFunctionArgs } from "@remix-run/node"
import { json } from "@remix-run/node"
import invariant from "tiny-invariant"
import InstanceManager from "~/analyzer/InstanceManager.server"
import { AuthorContributionData } from "~/components/DetailsCard"

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url)
  const branch = url.searchParams.get("branch")
  const repo = url.searchParams.get("repo")
  const path = url.searchParams.get("path")
  const isblob = url.searchParams.get("isblob")
  const grouping = url.searchParams.get("grouping")
  const metric = url.searchParams.get("metric")
  invariant(branch, "branch is required")
  invariant(repo, "repo is required")
  invariant(path, "path is required")
  invariant(isblob, "isblob is required")
  invariant(grouping, "grouping is required")
  invariant(metric, "metric is required")
  let chosen_metric = "LINE_CHANGE"
  if (metric === "MOST_COMMITS") {
    chosen_metric = "COMMITS"
  }
  console.log("metric_lol:", metric)
  console.log("metric_lol:", chosen_metric)

  const instance = InstanceManager.getInstance(repo, branch)
  if (!instance) return json([])

  let authorContributions: { author: string; contribs: number }[]

  if (grouping === "FILE_TYPE" && isblob === "false") {
    const path_adjusted = path.split("/").slice(0, -1).join("/").replace(/^\/+/, "")
    const extension = path.split(".").pop() || ""
    console.log("path_adjusted", path_adjusted)
    console.log("extension", extension)
    console.log("metric", metric)
    authorContributions = await instance.db.getAuthorContribsForExtension(path_adjusted, extension, chosen_metric)
  } else if (grouping === "JSON_RULES" && isblob === "false") {
    const path_adjusted = path.split("/").slice(0, -1).join("/").replace(/^\/+/, "")
    const keyword = path.split("#").pop() || ""
    console.log("path_adjusted", path_adjusted)
    console.log("extension", keyword)
    authorContributions = await instance.db.getAuthorContribsForKeyword(path_adjusted, keyword, chosen_metric)
  } else {
    console.log("path:", path)
    console.log("grouping:", grouping)
    authorContributions = await instance.db.getAuthorContribsForPath(path, isblob === "true", chosen_metric)
    console.log("response:", authorContributions)
  }

  const enrichedAuthorContributions: AuthorContributionData[] = []
  for (const authorCont of authorContributions) {
    const authorPathStats = await instance.db.getAuthorCommitsAndLinesForPath(
      authorCont.author,
      path,
      isblob === "true"
    )

    enrichedAuthorContributions.push({
      ...authorCont,
      commitsOnPath: authorPathStats?.commits ?? 0
    })
  }

  return json(enrichedAuthorContributions)
}
