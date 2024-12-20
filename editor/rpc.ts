import { Adapter } from "../src/adapter/fullstacked";
import type { Peer, PeerNearby } from "../src/connectivity/types";
import type { Project } from "./api/config/types";
import type esbuild from "esbuild";

export type SetupDirectories = {
    rootDirectory: string;
    configDirectory: string;
    nodeModulesDirectory: string;
};

export type AdapterEditor = Adapter & {
    // MIGRATION 2024-10-26 : Convert title based location to id

    migrate(project: Project): void;

    // END

    directories: SetupDirectories;

    esbuild: {
        version(): Promise<string>;
        baseJS(): Promise<string>;
        tmpFile: {
            write(name: string, content: string): Promise<string>;
            unlink(name: string): void;
        };
        check(): boolean;
        install(): void;
        build(
            entryPoint: string,
            outdir: string
        ): Promise<esbuild.BuildResult["errors"] | 1>;
    };

    run(project: Project): void;

    open(project: Project): void;

    connectivity: {
        infos: () => {
            port: number;
            networkInterfaces: { name: string; addresses: string[] }[];
        };
        name: string;
        peers: {
            nearby(): PeerNearby[];
        };
        advertise: {
            start(me: Peer, networkInterface: string): void;
            stop(): void;
        };
        browse: {
            start(): void;
            peerNearbyIsDead(id: string): void;
            stop(): void;
        };
        open(id: string, me: Peer): void;
        disconnect(id: string): void;
        trustConnection(id: string): void;
        send(id: string, data: string, pairing: boolean): void;
        convey(projectId: string, data: string): void;
    };
};

type OnlyOnePromise<T> = T extends PromiseLike<any> ? T : Promise<T>;

export type AwaitAll<T> = {
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

export type AwaitNone<T> = {
    [K in keyof T]: T[K] extends (...args: any) => PromiseLike<any>
        ? (
              ...args: T[K] extends (...args: infer P) => any ? P : never[]
          ) => Awaited<ReturnType<T[K]>>
        : AwaitNone<T[K]>;
};

const rpc = globalThis.rpc as unknown as () => AwaitAll<AdapterEditor>;

export default rpc;
