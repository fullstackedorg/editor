import { bridge } from "../../fullstacked_modules/bridge";
import { serializeArgs } from "../../fullstacked_modules/bridge/serialization";

// 100
export default function core_open(projectId: string) {
    const payload = new Uint8Array([100, ...serializeArgs([projectId])]);

    return bridge(payload);
}
