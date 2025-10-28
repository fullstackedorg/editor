import { serializeArgs } from "../../../fullstacked_modules/bridge/serialization";
import { bridge } from "../../../fullstacked_modules/bridge";
import core_message from "../../../fullstacked_modules/core_message";
import { Project } from "../../types";

// 90
export async function start(project: Project): Promise<string> {
    const payload = new Uint8Array([90, ...serializeArgs([project.id])]);
    return bridge(payload, ([transportId]) => transportId);
}

const requestsToProcess: [string, string][] = [];
async function processRequests() {
    const req = requestsToProcess.shift();
    if (!req) return;
    const payload = new Uint8Array([91, ...serializeArgs(req)]);
    await bridge(payload);
    processRequests();
}

// 91
export function request(transportId: string, message: string) {
    requestsToProcess.push([transportId, message]);
    processRequests();
}

// 92
export function end(transportId: string) {
    const payload = new Uint8Array([92, ...serializeArgs([transportId])]);
    return new Promise<void>((resolve) => {
        const listenToClose = (closeTransportId: string) => {
            if (closeTransportId === transportId) {
                core_message.removeListener("lsp-close", listenToClose);
                resolve();
            }
        };
        core_message.addListener("lsp-close", listenToClose);
        bridge(payload);
    });
}

// 93
export function version() {
    const payload = new Uint8Array([93]);
    return bridge(payload, ([version]) => version);
}
