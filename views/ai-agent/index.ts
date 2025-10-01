import config from "../../editor_modules/config";
import { CONFIG_TYPE } from "../../types";
import ai from "../../../fullstacked_modules/ai";

export async function getDefaultAgentProvider() {
    const agentConfigs = await config.get(CONFIG_TYPE.AGENT, true);
    const defaultAgent = agentConfigs?.find((c) => c.useDefault);

    if (!defaultAgent?.model) return null;

    const provider = ai.getProvider(defaultAgent);
    if (!provider) return null;

    try {
        const models = await provider.models();
        if (!models.includes(defaultAgent.model)) {
            return null;
        }
    } catch (e) {
        return null;
    }

    return {
        provider,
        info: defaultAgent
    };
}
