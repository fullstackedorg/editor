import { ipc } from "./ipc";
import { BridgeNode, initCallbackNode } from "./bridge/node";
import { BridgeIOS, initRespondIOS } from "./bridge/ios";
import { BridgeAndroid } from "./bridge/android";
import { BridgeWasm } from "./bridge/wasm";
import { BridgeWindows, initRespondWindows } from "./bridge/windows";
import { Platform } from "./fullstacked";

const platform = (await (await fetch("/platform")).text()) as Platform;

switch (platform) {
    case Platform.NODE:
        ipc.bridge = BridgeNode;
        initCallbackNode();
        break;
    case Platform.IOS:
        ipc.bridge = BridgeIOS;
        initRespondIOS();
        break;
    case Platform.ANDROID:
        ipc.bridge = BridgeAndroid;
        break;
    case Platform.WASM:
        ipc.bridge = BridgeWasm;
        break;
    case Platform.WINDOWS:
        ipc.bridge = BridgeWindows;
        initRespondWindows();
        break;
    case Platform.DOCKER:
    case Platform.ELECTRON:
        console.log("Bridge not yet implemented");
}

globalThis.platform = platform;
globalThis.ipc = ipc.methods;

// DEPRECATED 2024-11-13

(ipc.methods as any).platform = async () => platform;
globalThis.rpc = () => ipc.methods;
globalThis.onPush = {};

// END DEPRECATION

export default ipc;

const coreMessageListeners = new Map<string, Set<(message: string) => void>>();
export const addCoreMessageListener = (
    messageType: string,
    cb: (message: string) => void
) => {
    let listeners = coreMessageListeners.get(messageType);
    if (!listeners) {
        listeners = new Set<typeof cb>();
        coreMessageListeners.set(messageType, listeners);
    }
    listeners.add(cb);
};
export const removeCoreMessageListener = (
    messageType: string,
    cb: (message: string) => void
) => {
    let listeners = coreMessageListeners.get(messageType);
    listeners?.delete(cb);
    if (listeners?.size === 0) {
        coreMessageListeners.delete(messageType);
    }
};

globalThis.oncoremessage = (messageType: string, message: string) => {
    const listeners = coreMessageListeners.get(messageType);
    if (!listeners?.size) {
        console.log(`No core message listener for message of type [${messageType}]`);
    } else {
        listeners.forEach((cb) => cb(message));
    }
};

addCoreMessageListener("log", console.log);

(globalThis as any).addGoMessageListener = addCoreMessageListener;
(globalThis as any).removeMessageListener = removeCoreMessageListener;
