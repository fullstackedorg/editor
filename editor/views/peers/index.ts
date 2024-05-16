import type { Peer, NearbyPeer } from "../../../platform/node/src/bonjour";
import rpc from "../../rpc";
import "./index.css";

export class Peers {
    backAction: () => void;

    peersList = document.createElement("div");
    peers: (NearbyPeer | Peer)[] = [];

    constructor(){
        const peerEventHandler = (message: string) => {
            const peer: NearbyPeer | Peer = JSON.parse(message);
            const indexOf = this.peers.findIndex(({id}) => id === peer.id);
            if(indexOf >= 0) {
                this.peers[indexOf] = peer;
            } else {
                this.peers.push(peer);
            }
            this.renderPeersList()
        }

        (window as any).onPush["nearbyPeer"] = peerEventHandler;
        (window as any).onPush["peer"] = peerEventHandler;
    }
    
    renderPeersList(){
        const ul = document.createElement("ul");

        this.peers.forEach(peer => {
            const li = document.createElement("li");

            li.innerHTML = peer.name;
            
            if(peer.hasOwnProperty("addresses")) {
                const pairBtn = document.createElement("button");
                pairBtn.innerText = "Pair";
    
                pairBtn.addEventListener("click", async () => {
                    pairBtn.innerText = "Paring...";
                    pairBtn.disabled = true;
                    await rpc().peers.pair(peer as NearbyPeer);
                })
    
                li.append(pairBtn);
            } else {
                const bold = document.createElement("b");
                bold.innerText = "Paired";
                li.append(bold);
            }
            
            ul.append(li);
        });

        Array.from(this.peersList.children).forEach(e => e.remove());
        this.peersList.append(ul);
    }

    async renderManualInputDialog(){
        const dialog = document.createElement("div");
        dialog.id = "manual-peer-pairing";
        dialog.classList.add("dialog");

        const container = document.createElement("div");

        container.innerHTML = `<h2>Pair Manually</h2>`;

        const infos = document.createElement("div");
        infos.classList.add("net-infos");
        container.append(infos);

        rpc().peers.info()
            .then(async netInfo => {
                if(!netInfo) return;

                const netInfosContainer = document.createElement("div");

                netInfosContainer.innerHTML = await (await fetch("assets/icons/info.svg")).text();

                const dl = document.createElement("dl");

                dl.innerHTML = `<dt>Port</dt>
                <dd>${netInfo.port}</dd>`;

                netInfo.interfaces.forEach(({name, addresses}) => {
                    dl.innerHTML += `<dt>${name}</dt>
                    <dd><ul>${addresses.map(address => `<li>${address}</li>`).join("")}</ul></dd>`;
                });

                netInfosContainer.append(dl)

                infos.append(netInfosContainer);
            });

        const p = document.createElement("p");
        p.innerText = "Pair with another peer manually";
        container.append(p);

        const inputPort = document.createElement("input");
        inputPort.placeholder = "Port";
        container.append(inputPort);

        const inputAddress = document.createElement("input");
        inputAddress.placeholder = "IP or Host";
        container.append(inputAddress);

        const buttonGroup = document.createElement("div");
        buttonGroup.classList.add("button-group");

        const [
            closeIcon,
            checkIcon
        ] = await Promise.all([
            (await fetch("assets/icons/close.svg")).text(),
            (await fetch("assets/icons/check.svg")).text(),
        ])

        const cancelButton = document.createElement("button");
        cancelButton.classList.add("text", "danger");
        cancelButton.innerHTML = closeIcon;
        cancelButton.addEventListener("click", () => dialog.remove());
        buttonGroup.append(cancelButton);

        const pairButton = document.createElement("button");
        pairButton.classList.add("text");
        pairButton.innerHTML = checkIcon;
        pairButton.addEventListener("click", async() => {
            pairButton.disabled = true;
            pairButton.innerText = "Pairing...";

            const peer = {
                addresses: [ inputAddress.value ],
                name: `Manual Input [${inputAddress.value.includes(":") ? `[${inputAddress.value}]` : inputAddress.value}:${inputPort.value}]`,
                port: parseInt(inputPort.value),
                id: null
            }

            await rpc().peers.pair(peer)
            dialog.remove();
        });
        buttonGroup.append(pairButton);

        container.append(buttonGroup)

        dialog.append(container);

        document.body.append(dialog);
    }

    async render() {
        const container = document.createElement("div");
        container.classList.add("peers");

        const header = document.createElement("header");

        const left = document.createElement("div");

        const backButton = document.createElement("button");
        backButton.innerHTML = await (
            await fetch("/assets/icons/chevron.svg")
        ).text();
        backButton.classList.add("text");
        backButton.addEventListener("click", this.backAction);
        left.append(backButton);

        const title = document.createElement("h1");
        title.innerText = "Peers";
        left.append(title);

        header.append(left);

        const manualPairingButton = document.createElement("button");
        manualPairingButton.innerHTML = await (
            await fetch("/assets/icons/connect.svg")
        ).text();
        manualPairingButton.classList.add("text");
        manualPairingButton.addEventListener("click", () => this.renderManualInputDialog());
        header.append(manualPairingButton);

        container.append(header);

        container.append(this.peersList);

        rpc().peers.browse();
        rpc().peers.advertise();

        return container;
    }
}