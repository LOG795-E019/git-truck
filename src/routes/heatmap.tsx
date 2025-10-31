import type { LoaderFunctionArgs } from "@remix-run/node"
import { json } from "@remix-run/node"
import invariant from "tiny-invariant"
import InstanceManager from "~/analyzer/InstanceManager.server"

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url)
  const branch = url.searchParams.get("branch")
  const repo = url.searchParams.get("repo")
  const startTime = url.searchParams.get("startTime")
  const endTime = url.searchParams.get("endTime")

  invariant(branch, "branch is required")
  invariant(repo, "repo is required")
  invariant(startTime, "startTime is required")
  invariant(endTime, "endTime is required")

  const instance = InstanceManager.getInstance(repo, branch)
  if (!instance) {
    return json([])
  }

  const timerange: [number, number] = [parseInt(startTime), parseInt(endTime)]
  const heatMapData = await instance.db.getHeatMapData(timerange)

  return json(heatMapData)
}
