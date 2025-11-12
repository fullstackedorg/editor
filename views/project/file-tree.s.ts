import style, { CSSProperties } from "style";
import spacing from "../../style/spacing.s";
import colors, { opacity } from "../../style/colors.s";

const hidden: CSSProperties = {
    height: 0,
    width: 0,
    overflow: "hidden",
    padding: 0,
    margin: 0,
    position: "absolute",
    zIndex: -1,
    opacity: 0
};

export const importFileClass = "import-file";
export const openDirectoryClass = "open";
export const fileTreeContainerClass = style.createClass("file-tree-container", {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",

    "> div:first-child": {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: spacing.xs,
        paddingRight: spacing.xs,

        "> div": {
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: spacing.s
        },

        [`.${importFileClass}`]: {
            form: hidden,
            input: hidden
        }
    },

    ".file-tree": {
        overflow: "hidden",

        "> .scrollable > .file-items > .file-item > .indent > div": {
            width: "55%"
        },

        ".icon": {
            height: 16,
            width: 16
        },

        ".dev-icon": {
            fontSize: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",

            ".icon": {
                height: 20,
                width: 20,
                padding: "0 4px"
            }
        },

        [`.icon.${openDirectoryClass}`]: {
            transform: "rotate(90deg)"
        },

        ".file-item": {
            "&:hover": {
                backgroundColor: colors.gray.dark
            },

            ".suffix": {
                "> button": {
                    color: colors.light,
                    display: "none"
                }
            },

            "&.active": {
                backgroundColor: opacity(colors.blue.main, 50),

                ".suffix": {
                    "> button": {
                        display: "flex"
                    }
                }
            }
        }
    }
});
