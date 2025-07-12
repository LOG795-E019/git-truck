import type { LoaderFunctionArgs } from "@remix-run/node"
import invariant from "tiny-invariant"
import InstanceManager from "~/analyzer/InstanceManager.server"

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url)
  const branch = url.searchParams.get("branch")
  const repo = url.searchParams.get("repo")
  const path = url.searchParams.get("path")
  const isblob = url.searchParams.get("isblob")
  const grouping = url.searchParams.get("grouping")
  invariant(branch, "branch is required")
  invariant(repo, "repo is required")
  invariant(path, "path is required")
  invariant(isblob, "isblob is required")
  invariant(grouping, "grouping is required")
  console.log(url)

  const instance = InstanceManager.getInstance(repo, branch)
  if (!instance) return []
  if (grouping === "FILE_TYPE" && isblob === "false"){
    const path_adjusted = path.split("/").slice(0, -1).join("/").replace(/^\/+/, "")
    const extension = path.split('.').pop() || "" // Get the file extension
    console.log("path_adjusted", path_adjusted)
    console.log("extension", extension)
    return await instance.db.getAuthorContribsForExtension(path_adjusted, extension)
  }
  else if(grouping === "JSON_RULES" && isblob === "false"){
    const path_adjusted = path.split("/").slice(0, -1).join("/").replace(/^\/+/, "")
    const keyword = path.split('#').pop() || "" // Get the file extension
    console.log("path_adjusted", path_adjusted)
    console.log("extension", keyword)
    return await instance.db.getAuthorContribsForKeyword(path_adjusted, keyword)
  }
  else{
    console.log("path:", path)
    console.log("grouping:", grouping)
    const response = await instance.db.getAuthorContribsForPath(path, isblob === "true")
    console.log("response:", response)
    return response
  }
  
}
