import { redirect, type ActionFunction } from "@remix-run/node"
import DB from "~/analyzer/DB.server"
import InstanceManager from "~/analyzer/InstanceManager.server"

export const action: ActionFunction = async () => {
  await InstanceManager.closeAllDBConnections()
  await DB.clearCache()
  // Add cache busting timestamp to force reload
  return redirect(`/?t=${Date.now()}`)
}
