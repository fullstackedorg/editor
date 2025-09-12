import { bridge } from "../../../fullstacked_modules/bridge";

// 45
export function root() {
    const payload = new Uint8Array([45]);
    return bridge(payload, ([str]) => str);
}
