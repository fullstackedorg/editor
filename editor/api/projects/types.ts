import { Peer, PeerTrusted } from "../../../src/connectivity/types";

export type Project = {
    title: string;
    createdDate: number;
    location: string;
    gitRepository?: {
        url: string;
        name?: string;
        email?: string;
        merging?: string;
    };
};

export type GitAuths = {
    [hostname: string]: {
        username: string;
        password?: string;
        email?: string;
    };
};

export type Connectivity = {
    me: Peer;
    autoConnect: boolean;
    defaultNetworkInterface: string;
    peersTrusted: PeerTrusted[];
};
