export const compilerOptions = {
    esModuleInterop: true,
    module: "es2022",
    target: "es2022",
    moduleResolution: "node10",
    allowJs: true,
    lib: ["dom", "dom.iterable", "es2023"],
    jsx: "react",
    paths: {
        "*": ["../.fullstacked_modules/*"]
    },
    typeRoots: ["../.fullstacked_modules", "./node_modules/@types"]
};
