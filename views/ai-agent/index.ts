import config from "../../editor_modules/config";
import { CONFIG_TYPE } from "../../types";
export async function getDefaultAgentProvider() {
    const agentConfigs = await config.get(CONFIG_TYPE.AGENT);
    const defaultAgent = agentConfigs.find((c) => c.default);
    return defaultAgent;
}
