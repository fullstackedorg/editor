import { serializeArgs } from "../../../fullstacked_modules/bridge/serialization";
import { bridge } from "../../../fullstacked_modules/bridge";

// 90
export function request(message: string){
    const payload = new Uint8Array([
        90,
        ...serializeArgs([message])
    ]);
    bridge(payload)
}