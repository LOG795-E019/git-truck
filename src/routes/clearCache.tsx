import { redirect, type ActionFunction } from "@remix-run/node"
import DB from "~/analyzer/DB.server"
import InstanceManager from "~/analyzer/InstanceManager.server"

export const action: ActionFunction = async () => {
  // Close all DB connections first
  await InstanceManager.closeAllDBConnections()

  // Clear the cache directory
  await DB.clearCache()

  // Reset the metadata DB singleton to ensure it reads fresh data
  InstanceManager.metadataDB = null as any

  // Wait a bit to ensure all file operations complete
  await new Promise((resolve) => setTimeout(resolve, 100))

  // Add cache busting timestamp to force reload
  return redirect(`/?t=${Date.now()}`)
}
