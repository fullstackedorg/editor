import { SourceMapConsumer } from "source-map-js";
import { decodeUint8Array } from "./Uint8Array";

function syncRequest(pathComponents: string[], ...args){
    const request = new XMLHttpRequest();
    request.open("POST", pathComponents.join("/"), false);
    request.send(JSON.stringify(args));

    const contentType = request.getResponseHeader("content-type");
    let data: any;

    if (contentType?.startsWith("application/octet-stream"))
        data = new Uint8Array(request.response);
    else {
        data = request.responseText;
        if (contentType?.startsWith("application/json")) {
            data = JSON.parse(data, decodeUint8Array);
        }
    }

    if (request.status >= 299) {
        throw data;
    }

    return data;
}

async function fetchCall(pathComponents: string[], ...args) {
    const url = new URL(self.location.origin);
    url.pathname = pathComponents.join("/");

    const response = await fetch(url.toString(), {
        method: "POST",
        body: JSON.stringify(args)
    });

    const contentType = response.headers.get("content-type");

    let data: any;

    if (contentType?.startsWith("application/octet-stream"))
        data = new Uint8Array(await response.arrayBuffer());
    else {
        data = await response.text();
        if (contentType?.startsWith("application/json")) {
            data = JSON.parse(data, decodeUint8Array);
        }
    }

    if (response.status >= 299) {
        throw data;
    }

    return data;
}

function recurseInProxy(target: Function, pathComponents: string[] = []) {
    return new Proxy(target, {
        apply: (target, _, argArray) => {
            return target(pathComponents, ...argArray);
        },
        get: (_, p) => {
            pathComponents.push(p as string);
            return recurseInProxy(target, pathComponents);
        }
    });
}

export default function rpc<T>(syncronous = false) {
    if(syncronous) {
        return recurseInProxy(syncRequest) as unknown as AwaitAll<T>;
    }
    return recurseInProxy(fetchCall) as unknown as AwaitAll<T>;
}
globalThis.rpc = rpc;

type OnlyOnePromise<T> = T extends PromiseLike<any> ? T : Promise<T>;

type AwaitAll<T> = {
    [K in keyof T]: T[K] extends (...args: any) => any
        ? (
              ...args: T[K] extends (...args: infer P) => any ? P : never[]
          ) => OnlyOnePromise<
              T[K] extends (...args: any) => any ? ReturnType<T[K]> : any
          >
        : T[K] extends object
          ? AwaitAll<T[K]>
          : () => Promise<T[K]>;
};

globalThis.onPush = {} as {
    [messageType: string]: (message: string) => void;
};

const dispatchMessage = (messageType: string, message: string) => {
    const callback = globalThis.onPush[messageType];
    if (!callback) return false;

    callback(message);
    return true;
};

globalThis.push = (messageType: string, message: string) => {
    // try once
    if (!dispatchMessage(messageType, message)) {
        setTimeout(() => {
            // try twice
            if (!dispatchMessage(messageType, message))
                throw `No onPush callback for message type [${messageType}]. Received message [${message}]`;
        }, 150);
    }
};

// use a websocket for nodejs
const platform = await (rpc() as any).platform();
if (platform === "node") {
    const url =
        (self.location.protocol === "http:" ? "ws:" : "wss:") +
        "//" +
        self.location.host;
    const ws = new WebSocket(url);
    ws.onmessage = ({ data }) => {
        const { messageType, message } = JSON.parse(data);
        globalThis.push(messageType, message);
    };
}

globalThis.sourceMapConsumer = SourceMapConsumer;
