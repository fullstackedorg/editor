import vm from "vm"
import fs from "fs";
import type { fs as fsType, Response } from "../../../src/api"

export class JavaScript {
    private requestId = 0
    ctx = vm.createContext();

    privileged = false

    constructor(fsdir: string, assetdir: string, entrypointContents: string) {
        this.bindFs(fsdir);
        this.bindConsole();
        this.bindFetch();

        this.ctx.requests = {};
        this.ctx.assetdir = assetdir;

        const script = new vm.Script(entrypointContents);
        script.runInContext(this.ctx);
    }

    processRequest(
        headers: { [headerName: string]: string }, 
        pathname: string, 
        body: Uint8Array,
        onCompletion: (jsResponse: Response) => void
    ) {
        const requestId = this.requestId
        this.requestId += 1;

        this.ctx.requests[requestId] = [
            headers,
            pathname,
            body
        ]

        const script = new vm.Script(`api.default(...requests[${requestId}]);`);
        const cleanup = new vm.Script(`delete requests[${requestId}];`);

        const respond = (jsResponse: Response) => {
            onCompletion(jsResponse);
            cleanup.runInContext(this.ctx);
        }

        script.runInContext(this.ctx).then(respond);
    }

    private bindFs(rootdir: string) {
        const realpath = (path: string) => rootdir + "/" + path;
        const realpathForAsset = (path: string) => this.privileged ? path : realpath(path);

        const ctxFs: typeof fsType = {
            exists(itemPath, forAsset) {
                return fs.existsSync(forAsset ? realpathForAsset(itemPath) : realpath(itemPath))
            },
            mkdir(directory) {
                fs.mkdirSync(realpath(directory), { recursive: true });
            },
            putfile(filename, contents) {
                const uint8arr = new Uint8Array(contents.length);
                contents.forEach((num, i) => uint8arr[i] = num % 256);
                fs.writeFileSync(realpath(filename), uint8arr);
            },
            putfileUTF8(filename, contents) {
                fs.writeFileSync(realpath(filename), contents);
            },
            readdir(directory) {
                return fs.readdirSync(realpath(directory), { withFileTypes: true })
                    .map(item => ({
                        name: item.name,
                        isDirectory: item.isDirectory()
                    }))
            },
            readfile(filename, forAsset) {
                return new Uint8Array(fs.readFileSync(forAsset ? realpathForAsset(filename) : realpath(filename)));
            },
            readfileUTF8(filename, forAsset) {
                return fs.readFileSync(forAsset ? realpathForAsset(filename) : realpath(filename), { encoding: "utf-8" });
            },
            rm(itemPath) {
                fs.rmSync(realpath(itemPath), { recursive: true });
            }
        }

        this.ctx.fs = ctxFs;
    }

    private bindConsole() {
        this.ctx.console = {
            log: console.log
        }
    }

    private bindFetch() {
        this.ctx.fetch = async (url: string,
            options: {
                method?: "GET" | "POST" | "PUT" | "DELTE",
                headers?: Record<string, string>,
                body?: Uint8Array | number[]
            }) => {
                const response = await fetch(url, {
                    method: options?.method || "GET",
                    headers: options?.headers || {},
                    body: options?.body ? Buffer.from(options?.body) : undefined
                });
                return response.arrayBuffer();
            };
    }
}