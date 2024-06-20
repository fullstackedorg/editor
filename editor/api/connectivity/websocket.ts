import { Connecter } from "../../../src/connectivity/connecter";
import { PEER_CONNECTION_TYPE, PeerNearbyBonjour } from "../../../src/connectivity/types";

export class ConnectWebSocket implements Connecter {
    connections: { id: string; trusted: boolean; ws: WebSocket }[] = [];
    manualRequests = new Set<string>();

    onPeerData: (id: string, data: string) => void;
    onPeerConnection: (id: string, type: PEER_CONNECTION_TYPE, state: "open" | "close") => void;

    private tryToConnectWebSocket(
        address: string,
        secure: boolean,
        port?: number
    ) {
        const hostname = address.includes(":") ? `[${address}]` : address;
        const protocol = secure ? "wss" : "ws";
        const url = protocol + "://" + hostname + (port ? `:${port}` : "");

        console.log(url);

        return new Promise<WebSocket>((resolve, reject) => {
            let ws: WebSocket,
                didResolve = false;
            try {
                ws = new WebSocket(url);
            } catch (e) {
                reject();
            }

            setTimeout(() => {
                if (didResolve) return;
                reject();
            }, 1000 * 5); // 5s timeout

            ws.onerror = () => {
                reject();
            };

            ws.onopen = () => {
                didResolve = true;
                resolve(ws);
            };
        });
    }

    async open(id: string, peerNearby: PeerNearbyBonjour) {
        let ws: WebSocket;

        for (const address of peerNearby.addresses) {
            try {
                ws = await this.tryToConnectWebSocket(
                    address,
                    false,
                    peerNearby.port
                );
                break;
            } catch (e) {}
        }

        if (!ws) {
            this.disconnect(id);
            return;
        }

        this.connections.push({
            id,
            trusted: false,
            ws
        });

        const onopen = () => {
            this.onPeerConnection?.(id, PEER_CONNECTION_TYPE.WEB_SOCKET, "open");
        };
        ws.onopen = onopen;
        if (ws.readyState === WebSocket.OPEN) {
            onopen();
        }

        ws.onclose = () => {
            const indexOf = this.connections.findIndex(
                (conn) => conn.id === id
            );
            if (indexOf <= -1) return;
            this.connections.splice(indexOf, 1);
            this.onPeerConnection?.(id, PEER_CONNECTION_TYPE.WEB_SOCKET, "close");
        };
        ws.onmessage = (message) => {
            if (message.type === "binary") {
                console.log("Binary message on websocket is not yet supported");
                return;
            }

            const connection = this.connections.find((conn) => conn.id === id);
            if(!connection) {
                ws.close()
            } else {
                this.onPeerData?.(id, message.data);
            }
        };
    }

    trustConnection(id: string): void {
        const connection = this.connections.find((conn) => conn.id === id);
        if (!connection) return;
        connection.trusted = true;
    }

    disconnect(id: string): void {
        const indexOf = this.connections.findIndex((conn) => conn.id === id);
        this.connections[indexOf]?.ws.close();
    }

    send(id: string, data: string, pairing = false): void {
        const connection = this.connections.find((conn) => conn.id === id);
        if (!connection?.trusted && !pairing) return;
        connection.ws.send(data);
    }
}
