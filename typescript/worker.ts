import {
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
import fs_sync, { cache as fsCache, initCache } from "../fs_sync";
import { FileEvent, FileEventType } from "../views/project/file-event";

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

self.onmessage = (message: MessageEvent) => {
    const { id, methodPath, args } = message.data;

    let method = methodPath.reduce(
        (obj, key) => (obj ? obj[key] : undefined),
        methods
    ) as any;

    if (typeof method === "function") {
        const response = method(...args);
        const data = removeSourceObjects(response);
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
    allowJs: true,
    lib: ["lib.dom.d.ts", "lib.dom.iterable.d.ts", "lib.es2023.d.ts"],
    jsx: JsxEmit.React
};
let services: LanguageService;
let td: TextDecoder;

export let methods = {
    version() {
        return version;
    },
    // for WASM only
    syncTsLib(tsLib: { [path: string]: Uint8Array }) {
        initCache();
        if (!td) td = new TextDecoder();
        for (const [path, data] of Object.entries(tsLib)) {
            if (data === null) continue;

            const p = path.slice("editor/".length);
            fsCache.set(p, td.decode(data));
        }
    },
    // for WASM only
    syncProjectFiles(
        projectFiles: { [path: string]: Uint8Array },
        remove: boolean
    ) {
        initCache();
        if (!td) td = new TextDecoder();

        for (const [path, data] of Object.entries(projectFiles)) {
            if (!data) continue;
            const fileName = path.slice("projects/".length);
            if (remove) {
                fsCache.delete(fileName);
            } else {
                fsCache.set(fileName, td.decode(data));
            }
        }
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

        // settings gets typescript version
        if (currentDirectory === "") {
            return;
        }

        const filePaths = fs_sync.readdir(currentDirectory, [".build", ".git"]);
        filePaths.forEach((filePath) => {
            const path = workingDirectory + "/" + filePath;
            if (!files.has(path)) {
                files.set(path, {
                    contents: null,
                    version: 0,
                    source: true
                });
            }
        });

        const fullstackedModules = fs_sync.fullstackedModulesList();
        fullstackedModules.forEach((filePath) => {
            const path = "node_modules/" + filePath;
            if (!files.has(path)) {
                files.set(path, {
                    contents: null,
                    version: 0,
                    source: path.endsWith(".d.ts")
                });
            }
        });
    },
    updateFile(fileName: string, contents: string) {
        if (!fileName.includes(workingDirectory)) {
            return;
        }

        let file = files?.get(fileName);
        if (!file) {
            file = {
                contents,
                version: 0,
                source: false
            };
            files.set(fileName, file);
        }

        file.contents = contents;
        file.version += 1;

        // this will make the file a source file from now on
        file.source = true;

        if (file.deletionTimeout) {
            clearTimeout(file.deletionTimeout);
        }
    },
    fileEvents(e: FileEvent[]) {
        if (!workingDirectory) return;

        for (const fileEvent of e) {
            if (
                fileEvent.type === FileEventType.MODIFIED &&
                fileEvent.origin === "code-editor"
            ) {
                continue;
            }

            fileEvent.paths = fileEvent.paths
                .map((p) => {
                    if (!p.includes(workingDirectory)) return null;

                    const components = p.split(workingDirectory);
                    return workingDirectory + components.slice(1).join("/");
                })
                .filter(Boolean);

            switch (fileEvent.type) {
                case FileEventType.CREATED:
                    if (fileEvent.isFile) {
                        const p = fileEvent.paths.at(0);
                        const f = files.get(p);
                        if (!f) {
                            files.set(fileEvent.paths.at(0), {
                                contents: null,
                                version: 0,
                                source: false
                            });
                        } else if (f.deletionTimeout) {
                            clearTimeout(f.deletionTimeout);
                        }
                    }
                    break;
                case FileEventType.MODIFIED:
                    const file = files.get(fileEvent.paths.at(0));
                    if (file) {
                        file.contents = null;
                        file.version += 1;
                    }
                    break;
                case FileEventType.RENAME:
                    const f = files.get(fileEvent.paths.at(0));
                    if (f) {
                        files.set(fileEvent.paths.at(1), f);
                        files.delete(fileEvent.paths.at(0));
                    }
                    break;
                case FileEventType.DELETED:
                    const path = fileEvent.paths.at(0);
                    if (fileEvent.isFile) {
                        deleteFile(path, fileEvent.origin === "git" ? 1000 : 0);
                    } else {
                        // delete all sub file to directory
                        for (const p of files.keys()) {
                            if (p?.startsWith?.(path)) {
                                deleteFile(p);
                            }
                        }
                    }
            }
        }
    },

    ...services
};

function deleteFile(path: string, timeout: number = null) {
    const f = files.get(path);
    if (f) {
        if (timeout) {
            f.deletionTimeout = setTimeout(() => {
                files.delete(path);
            }, timeout);
        } else {
            files.delete(path);
        }
    }
}

let workingDirectory: string = null;
let files: Map<
    string,
    {
        contents: string;
        version: number;
        source: boolean;
        deletionTimeout?: ReturnType<typeof setTimeout>;
    }
> = new Map();

const debug = false;

function initLanguageServiceHost(): LanguageServiceHost {
    return {
        getCompilationSettings: () => options,
        getScriptFileNames: function (): string[] {
            if (debug) {
                console.log("getScriptFileNames");
            }

            return Array.from(files.entries())
                .filter(([_, { source }]) => source)
                .map(([name]) => name);
        },
        getScriptVersion: function (fileName: string) {
            if (debug) {
                console.log("getScriptVersion", fileName);
            }

            return (files.get(fileName)?.version ?? 0).toString();
        },
        getScriptSnapshot: function (fileName: string) {
            if (debug) {
                console.log("getScriptSnapshot", fileName);
            }

            let file = files.get(fileName);

            // we only load on the fly the tsLib files
            // since they are not in the project directory
            if (!file && fileName.startsWith("tsLib")) {
                file = {
                    contents: fs_sync.staticFile(fileName),
                    source: false,
                    version: 1
                };
            }

            if (!file) {
                return null;
            }

            if (file.contents === null) {
                file.contents = fileName.startsWith("node_modules")
                    ? fs_sync.fullstackedModule(fileName)
                    : fs_sync.readFile(fileName);
            }

            return file.contents
                ? ScriptSnapshot.fromString(file.contents)
                : null;
        },
        getCurrentDirectory: function () {
            if (debug) {
                console.log("getCurrentDirectory");
            }
            return "";
        },
        getDefaultLibFileName: function (options: CompilerOptions) {
            if (debug) {
                console.log("getDefaultLibFileName");
            }
            return "tsLib/lib.d.ts";
        },
        readFile: function (fileName: string) {
            if (debug) {
                console.log("readFile", fileName);
            }

            let file = files.get(fileName);

            if (!file && fileName.startsWith("tsLib")) {
                file = {
                    contents: fs_sync.staticFile(fileName),
                    source: false,
                    version: 1
                };
                files.set(fileName, file);
            }

            if (!file) {
                return null;
            }

            if (file.contents === null) {
                file.contents = fileName.startsWith("node_modules")
                    ? fs_sync.fullstackedModule(fileName)
                    : fs_sync.readFile(fileName);
            }

            return file.contents;
        },
        fileExists: function (fileName: string) {
            if (debug) {
                console.log("fileExists", fileName);
            }

            return !!files.get(fileName);
        }
    };
}

self.postMessage({ ready: true });
