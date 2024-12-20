import {
    IScriptSnapshot,
    createLanguageService,
    createDocumentRegistry,
    CompilerOptions,
    JsxEmit,
    LanguageService,
    LanguageServiceHost,
    ModuleKind,
    ModuleResolutionKind,
    ScriptSnapshot,
    ScriptTarget,
    isSourceFile,
    version
} from "typescript";
import type { AdapterEditor } from "../rpc";
import type { rpcSync as rpcSyncFn } from "../../src/index";
import type rpcFn from "../../src/index";
import { bindPassRequestBody } from "../../src/android";

const rpc = globalThis.rpc as typeof rpcFn<AdapterEditor>;
const rpcSync = globalThis.rpcSync as typeof rpcSyncFn<AdapterEditor>;

function removeSourceObjects(obj: any) {
    if (typeof obj === "object") {
        Object.keys(obj).forEach((key) => {
            if (key === "file" && isSourceFile(obj[key])) {
                obj[key] = "[File]";
            } else {
                obj[key] = removeSourceObjects(obj[key]);
            }
        });
    } else if (typeof obj === "function") {
        return "[Function]";
    }
    return obj;
}

const passingBodyToMainThread = new Map<number, () => void>();

self.onmessage = (message: MessageEvent) => {
    if (message.data.request_id) {
        const resolve = passingBodyToMainThread.get(message.data.request_id);
        resolve?.();
        passingBodyToMainThread.delete(message.data.request_id);
        return;
    }

    if (message.data.platform) {
        if (message.data.platform === "android") {
            bindPassRequestBody((id, body) => {
                return new Promise<void>((resolve) => {
                    passingBodyToMainThread.set(id, resolve);
                    self.postMessage({ id, body });
                });
            });
        }

        return;
    }

    const { id, methodPath, args } = message.data;

    let method = methodPath.reduce(
        (obj, key) => (obj ? obj[key] : undefined),
        methods
    ) as any;

    if (typeof method === "function") {
        const data = removeSourceObjects(method(...args));
        self.postMessage({
            id,
            data
        });
    }
};

const options: CompilerOptions = {
    esModuleInterop: true,
    module: ModuleKind.ES2022,
    target: ScriptTarget.ES2022,
    moduleResolution: ModuleResolutionKind.Node10,
    lib: ["lib.dom.d.ts", "lib.es2023.d.ts", "fullstacked.d.ts"],
    jsx: JsxEmit.React
};
let services: LanguageService;
let updateThrottler: ReturnType<typeof setTimeout> = null;

export let methods = {
    version() {
        return version;
    },
    start(currentDirectory: string) {
        if (services) return;

        workingDirectory = currentDirectory;

        const servicesHost = initLanguageServiceHost();
        services = createLanguageService(
            servicesHost,
            createDocumentRegistry()
        );
        methods = {
            ...methods,
            ...services
        };
    },
    invalidateWorkingDirectory() {
        sourceFiles = null;
    },
    updateFile(sourceFile: string, contents: string, now = false) {
        makeSureSourceFilesAreLoaded();

        sourceFiles[sourceFile] = {
            contents,
            lastVersionSaved: sourceFiles?.[sourceFile]?.lastVersionSaved
                ? sourceFiles?.[sourceFile]?.lastVersionSaved
                : 0,
            version: sourceFiles?.[sourceFile]?.version
                ? sourceFiles?.[sourceFile]?.version + 1
                : 1
        };

        if (updateThrottler) clearTimeout(updateThrottler);

        updateThrottler = setTimeout(
            () => {
                Promise.all(
                    Object.entries(sourceFiles).map(
                        ([filename, { contents, lastVersionSaved, version }]) =>
                            new Promise<void>(async (res) => {
                                if (lastVersionSaved === version) return res();

                                if (
                                    await rpc().fs.exists(filename, {
                                        absolutePath: true
                                    })
                                ) {
                                    await rpc().fs.writeFile(
                                        filename,
                                        contents,
                                        {
                                            absolutePath: true
                                        }
                                    );
                                    sourceFiles[filename].lastVersionSaved =
                                        version;
                                } else {
                                    delete sourceFiles[filename];
                                }
                                res();
                            })
                    )
                ).then(() => (updateThrottler = null));
            },
            now ? 0 : 2000
        );
    },
    ...services
};

let workingDirectory: string;
let sourceFiles: {
    [filename: string]: {
        contents: string;
        lastVersionSaved: number;
        version: number;
    };
} = null;
const makeSureSourceFilesAreLoaded = () => {
    if (sourceFiles !== null) return;

    if (!workingDirectory) {
        throw new Error(
            "Trying to load source files before having set working directory."
        );
    }

    const files = (
        rpcSync().fs.readdir(workingDirectory, {
            recursive: true,
            absolutePath: true
        }) as string[]
    ).map((filename) => workingDirectory + "/" + filename);

    sourceFiles = {};

    files.forEach((file) => {
        const version = rpcSync().fs.stat(file, { absolutePath: true }).mtimeMs;
        sourceFiles[file] = {
            contents: null,
            version,
            lastVersionSaved: version
        };
    });
};

const scriptSnapshotCache: {
    [path: string]: IScriptSnapshot;
} = {};
let nodeModules: Map<string, string[]> = new Map();

const nodeModulesDirectory = await rpc().directories.nodeModulesDirectory();
const resolveNodeModulePath = (path: string) =>
    nodeModulesDirectory + "/" + path.slice("node_modules/".length);

function initLanguageServiceHost(): LanguageServiceHost {
    return {
        getCompilationSettings: () => options,
        getScriptFileNames: function (): string[] {
            // console.log("getScriptFileNames");

            makeSureSourceFilesAreLoaded();

            return Object.keys(sourceFiles);
        },
        getScriptVersion: function (fileName: string) {
            // console.log("getScriptVersion", fileName);

            if (
                fileName.includes("tsLib") ||
                fileName.startsWith("node_modules")
            ) {
                return "1";
            }

            makeSureSourceFilesAreLoaded();

            return sourceFiles[fileName].version.toString();
        },
        getScriptSnapshot: function (fileName: string) {
            // console.log("getScriptSnapshot", fileName);

            if (fileName.includes("tsLib")) {
                if (!scriptSnapshotCache[fileName]) {
                    scriptSnapshotCache[fileName] = ScriptSnapshot.fromString(
                        rpcSync().fs.readFile(fileName, {
                            encoding: "utf8"
                        }) as string
                    );
                }
                return scriptSnapshotCache[fileName];
            } else if (fileName.startsWith("node_modules")) {
                if (!scriptSnapshotCache[fileName]) {
                    scriptSnapshotCache[fileName] = ScriptSnapshot.fromString(
                        rpcSync().fs.readFile(resolveNodeModulePath(fileName), {
                            encoding: "utf8",
                            absolutePath: true
                        }) as string
                    );
                }
                return scriptSnapshotCache[fileName];
            }

            makeSureSourceFilesAreLoaded();

            if (!sourceFiles[fileName]) {
                return null;
            }

            if (sourceFiles[fileName].contents === null) {
                sourceFiles[fileName].contents = rpcSync().fs.readFile(
                    fileName,
                    {
                        encoding: "utf8",
                        absolutePath: true
                    }
                ) as string;
            }

            return ScriptSnapshot.fromString(sourceFiles[fileName].contents);
        },
        getCurrentDirectory: function () {
            // console.log("getCurrentDirectory");
            return "";
        },
        getDefaultLibFileName: function (options: CompilerOptions) {
            // console.log("getDefaultLibFileName");
            return "tsLib/lib.d.ts";
        },
        readFile: function (path: string) {
            // console.log("readFile", path);
            if (path.startsWith("node_modules")) {
                if (!scriptSnapshotCache[path]) {
                    scriptSnapshotCache[path] = ScriptSnapshot.fromString(
                        rpcSync().fs.readFile(resolveNodeModulePath(path), {
                            absolutePath: true,
                            encoding: "utf8"
                        }) as string
                    );
                }

                return scriptSnapshotCache[path].getText(
                    0,
                    scriptSnapshotCache[path].getLength()
                );
            }

            makeSureSourceFilesAreLoaded();

            if (!sourceFiles[path]) {
                return null;
            }

            if (sourceFiles[path].contents === null) {
                sourceFiles[path].contents = rpcSync().fs.readFile(path, {
                    encoding: "utf8",
                    absolutePath: true
                }) as string;
            }

            return sourceFiles[path].contents;
        },
        fileExists: function (path: string) {
            // console.log("fileExists", path);

            if (path.startsWith("node_modules")) {
                const pathComponents = path.split("/");
                const moduleName = pathComponents.at(1).startsWith("@")
                    ? pathComponents.at(1) + "/" + pathComponents.at(2)
                    : pathComponents.at(1);

                let moduleFiles = nodeModules.get(moduleName);

                if (!moduleFiles) {
                    try {
                        moduleFiles = (
                            rpcSync().fs.readdir(
                                nodeModulesDirectory + "/" + moduleName,
                                {
                                    recursive: true,
                                    absolutePath: true
                                }
                            ) as string[]
                        ).map(
                            (file) => "node_modules/" + moduleName + "/" + file
                        );
                    } catch (e) {
                        moduleFiles = [];
                    }

                    nodeModules.set(moduleName, moduleFiles);
                }

                return moduleFiles.includes(path);
            }

            makeSureSourceFilesAreLoaded();

            return Object.keys(sourceFiles).includes(path);
        }
    };
}

self.postMessage({ ready: true });
