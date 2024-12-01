import { bridge } from "../bridge";
import { serializeArgs } from "../bridge/serialization";

const te = new TextEncoder();

// 2
export function readFile(path: string): Promise<Uint8Array>;
export function readFile(path: string, options: { encoding: "utf8" }): Promise<string>;
export function readFile(path: string, options?: { encoding: "utf8" }) {
    const payload = new Uint8Array([
        2,
        ...serializeArgs([path, options?.encoding === "utf8"])
    ]);

    const transformer = ([stringOrBuffer]) => stringOrBuffer;

    return bridge(payload, transformer);
}

// 3
export function writeFile(path: string, data: string | Uint8Array): Promise<boolean> {
    if (typeof data === "string") {
        data = te.encode(data);
    }

    const payload = new Uint8Array([3, ...serializeArgs([path, data])]);

    return bridge(payload, ([success]) => success);
}

// 4
export function unlink(path: string): Promise<boolean> {
    const payload = new Uint8Array([4, ...serializeArgs([path])]);

    return bridge(payload, ([success]) => success);
}

export type Dirent = {
    name: string;
    isDirectory: boolean;
};

// 5
export function readdir(
    path: string,
    options?: { recursive?: boolean; withFileTypes?: false }
): Promise<string[]>;
export function readdir(
    path: string,
    options?: { recursive?: boolean; withFileTypes: true }
): Promise<Dirent[]>;
export function readdir(
    path: string,
    options?: { recursive?: boolean; withFileTypes?: boolean }
) {
    const payload = new Uint8Array([
        5,
        ...serializeArgs([path, !!options?.recursive, !!options?.withFileTypes])
    ]);

    const transformer = (items: string[] | (string | boolean)[]) => {
        if (options?.withFileTypes) {
            const dirents: Dirent[] = [];
            for (let i = 0; i < items.length; i = i + 2) {
                dirents.push({
                    name: items[i] as string,
                    isDirectory: items[i + 1] as boolean
                });
            }
            return dirents;
        }

        return items;
    };

    return bridge(payload, transformer);
}

// 6
export function mkdir(path: string): Promise<boolean> {
    const payload = new Uint8Array([6, ...serializeArgs([path])]);

    return bridge(payload, ([success]) => success);
}

// 7
export function rmdir(path: string): Promise<boolean> {
    const payload = new Uint8Array([7, ...serializeArgs([path])]);

    return bridge(payload, ([success]) => success);
}

// 8
export function exists(path: string): Promise<{ isFile: boolean }> {
    const payload = new Uint8Array([8, ...serializeArgs([path])]);

    const transformer = ([exists, isFile]: [boolean, boolean]) => {
        if (!exists) return undefined;
        return { isFile };
    };

    return bridge(payload, transformer);
}

// 9
export function rename(oldPath: string, newPath: string): Promise<boolean> {
    const payload = new Uint8Array([9, ...serializeArgs([oldPath, newPath])]);

    return bridge(payload, ([success]) => success);
}

// 10
export function stat(path: string): Promise<{
    name: string;
    size: number;
    modTime: number;
    isDirectory: boolean;
}> {
    const payload = new Uint8Array([10, ...serializeArgs([path])]);

    const transformer = (responseArgs: any[]) => {
        if (!responseArgs.length) return null;

        const [name, size, modTime, isDirectory] = responseArgs;

        return {
            name,
            size,
            modTime,
            isDirectory
        };
    };

    return bridge(payload, transformer);
}