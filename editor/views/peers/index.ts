import {
    PEER_ADVERSTISING_METHOD,
    PEER_CONNECTION_STATE
} from "../../../src/connectivity/types";
import api from "../../api";
import rpc from "../../rpc";
import { Dialog } from "../../components/dialog";
import { Button } from "../../components/primitives/button";
import { InputText } from "../../components/primitives/inputs";
import { TopBar } from "../../components/top-bar";
import { ViewScrollable } from "../../components/view-scrollable";
import { find } from "../project/code-editor";
import {
    PEER_DISCONNECT_BUTTON_CLASS,
    PEER_PAIR_BUTTON_CLASS,
    PEERS_VIEW_ID
} from "../../constants";

let reloadLists: () => void;
const singletonReloadList = () => reloadLists();

export function Peers() {
    const { container, scrollable } = ViewScrollable();
    container.id = PEERS_VIEW_ID;
    container.classList.add("view");

    const connectionButton = Button({
        style: "icon-large",
        iconLeft: "Link"
    });

    connectionButton.onclick = () => ManualConnect();

    const topBar = TopBar({
        title: "Peers",
        actions: [connectionButton]
    });

    container.prepend(topBar);

    const lists = document.createElement("div");
    lists.classList.add("peers-lists");

    const peersConnects = Connected();
    const peersNearby = Nearby();
    const peersTrusted = Trusted();

    reloadLists = () => {
        peersConnects.reloadList();
        peersNearby.reloadList();
        peersTrusted.reloadList();
    };
    reloadLists();

    api.connectivity.peers.onPeersEvent.add(singletonReloadList);

    lists.append(
        peersConnects.container,
        peersNearby.container,
        peersTrusted.container
    );
    scrollable.append(lists);

    api.connectivity.advertise.start();
    api.connectivity.browse.start();

    return container;
}

function reloadPeersConnected(count: HTMLSpanElement) {
    const list = document.createElement("ul");

    count.innerText = api.connectivity.peers.connections().size.toString();

    for (const peerConnection of api.connectivity.peers
        .connections()
        .values()) {
        const item = document.createElement("li");

        item.innerText = peerConnection.peer.name;

        const right = document.createElement("div");

        if (peerConnection.state === PEER_CONNECTION_STATE.PAIRING) {
            right.innerHTML = `<small>Paring (<span class="code">${peerConnection.validation}</span>)</small>`;
        }

        const disconnectButton = Button({
            text: "Disconnect",
            color: "red"
        });
        disconnectButton.classList.add(PEER_DISCONNECT_BUTTON_CLASS);
        disconnectButton.onclick = () => {
            disconnectButton.disabled = true;
            api.connectivity.disconnect(peerConnection);
        };

        right.append(disconnectButton);
        item.append(right);

        list.append(item);
    }

    return list;
}

function Connected() {
    const container = document.createElement("div");

    const title = document.createElement("h3");
    title.innerText = "Connected";

    const count = document.createElement("span");
    title.append(" (", count, ")");
    count.innerText = api.connectivity.peers.connections().size.toString();

    container.append(title);

    let list: ReturnType<typeof reloadPeersConnected> =
        document.createElement("ul");
    container.append(list);
    const reloadList = () => {
        const updatedList = reloadPeersConnected(count);
        list.replaceWith(updatedList);
        list = updatedList;
    };
    reloadList();

    return { container, reloadList };
}

async function reloadPeersNearby(count: HTMLSpanElement) {
    const list = document.createElement("ul");

    let peersNearby = await api.connectivity.peers.nearby();
    const peersConnections = api.connectivity.peers.connections().values();
    peersNearby = peersNearby.filter(
        ({ peer }) =>
            !find(peersConnections, ({ peer: { id } }) => id === peer.id)
    );

    count.innerText = peersNearby.length.toString();

    peersNearby.forEach((peerNearby) => {
        const item = document.createElement("li");

        item.innerText = peerNearby.peer.name;

        const pairButton = Button({
            text: "Pair"
        });
        pairButton.classList.add(PEER_PAIR_BUTTON_CLASS);
        item.append(pairButton);
        pairButton.onclick = () => {
            pairButton.disabled = true;
            api.connectivity.connect(peerNearby);
        };

        list.append(item);
    });

    return list;
}

function Nearby() {
    const container = document.createElement("div");

    const title = document.createElement("h3");
    title.innerText = "Nearby";

    const count = document.createElement("span");
    title.append(" (", count, ")");
    count.innerText = "0";

    container.append(title);

    let list: Awaited<ReturnType<typeof reloadPeersNearby>> =
        document.createElement("ul");
    container.append(list);
    const reloadList = async () => {
        const updatedList = await reloadPeersNearby(count);
        list.replaceWith(updatedList);
        list = updatedList;
    };
    reloadList();

    return { container, reloadList };
}

async function reloadPeersTrusted(count: HTMLSpanElement) {
    const list = document.createElement("ul");

    const peersTrusted = await api.connectivity.peers.trusted();
    count.innerText = peersTrusted.length.toString();

    peersTrusted.forEach((peerTrusted) => {
        const item = document.createElement("li");

        item.innerText = peerTrusted.name;

        const forgetButton = Button({
            text: "Forget",
            color: "red"
        });

        forgetButton.onclick = () => {
            forgetButton.disabled = true;
            item.remove();
            api.connectivity.forget(peerTrusted);
        };

        item.append(forgetButton);

        list.append(item);
    });

    return list;
}

function Trusted() {
    const container = document.createElement("div");

    const title = document.createElement("h3");
    title.innerText = "Trusted";

    const count = document.createElement("span");
    title.append(" (", count, ")");
    count.innerText = "0";

    container.append(title);

    let list: Awaited<ReturnType<typeof reloadPeersTrusted>> =
        document.createElement("ul");
    container.append(list);

    const reloadList = async () => {
        const updatedList = await reloadPeersTrusted(count);
        list.replaceWith(updatedList);
        list = updatedList;
    };
    reloadList();

    return { container, reloadList };
}

function ManualConnect() {
    const container = document.createElement("div");
    container.classList.add("connect-manually");

    const title = document.createElement("h3");
    title.innerText = "Connect Manually";

    container.append(title);

    rpc()
        .connectivity.infos()
        .then((netInfo) => {
            if (!netInfo?.port || netInfo?.networkInterfaces?.length === 0)
                return;

            const netInfoContainer = document.createElement("div");
            netInfoContainer.classList.add("net-info");

            netInfoContainer.innerHTML = `
                <b>Your Network Info</b>
                <div>
                    ${netInfo.networkInterfaces
                        .map((inet) => {
                            return `
                            <div>
                                <div><b>${inet.name}</b></div>
                                ${inet.addresses.map((addr) => `<div>${addr}</div>`).join("")}
                            </div>
                        `;
                        })
                        .join("")}
                </div>
                <div>
                    <div>
                        <div><b>Port</b></div>
                        <div>${netInfo.port}</div>
                    </div>
                </div>
            `;

            title.insertAdjacentElement("afterend", netInfoContainer);
        });

    const form = document.createElement("form");

    const addressInput = InputText({
        label: "Address"
    });
    const portInput = InputText({
        label: "Port"
    });

    const buttonRow = document.createElement("div");

    const cancelButton = Button({
        text: "Cancel",
        style: "text"
    });
    cancelButton.type = "button";
    cancelButton.onclick = () => remove();

    const connectButton = Button({
        text: "Connect"
    });
    buttonRow.append(cancelButton, connectButton);

    form.append(addressInput.container, portInput.container, buttonRow);

    form.onsubmit = (e) => {
        e.preventDefault();
        const address = addressInput.input.value;
        const port = portInput.input.value;

        api.connectivity.connect(
            {
                peer: {
                    id: null,
                    name: `Manual Peer Connection [${address.includes(":") ? `[${address}]` : address}:${port}]`
                },
                type: PEER_ADVERSTISING_METHOD.BONJOUR,
                addresses: [address],
                port: parseInt(port)
            },
            false
        );

        remove();
    };

    container.append(form);

    const { remove } = Dialog(container);
}
