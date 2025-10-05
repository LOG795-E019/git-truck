import type { LoaderFunctionArgs } from "@remix-run/node"
import invariant from "tiny-invariant"
import InstanceManager from "~/analyzer/InstanceManager.server"

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url)
  const branch = url.searchParams.get("branch")
  const repo = url.searchParams.get("repo")
  const path = url.searchParams.get("path")
  const grouping = url.searchParams.get("grouping")

  invariant(branch, "branch is required")
  invariant(repo, "repo is required")
  invariant(path, "path is required")
  invariant(grouping, "grouping is required")

  const instance = InstanceManager.getInstance(repo, branch)
  if (!instance) return []
  if (grouping === "FILE_TYPE") {
    const path_adjusted = path.split("/").slice(0, -1).join("/").replace(/^\/+/, "")
    const extension = path.split(".").pop() || "" // Get the file extension
    console.log("path_adjusted", path_adjusted)
    console.log("extension", extension)
    return await instance.db.getCommitCountForFileType(path_adjusted, extension)
  } else {
    console.log("path:", path)
    console.log("grouping:", grouping)
    return await instance.db.getCommitCountForPath(path)
  }
}
