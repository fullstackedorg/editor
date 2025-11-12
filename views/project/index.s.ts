import style from "style";
import spacing from "../../style/spacing.s";
import typography from "../../style/typography.s";
import { fileTreePanelWidth, workspaceClass } from "./workspace/index.s";
import colors from "../../style/colors.s";
import { topBarActionsClass } from "../../components/top-bar.s";

export const loaderContainerClass = "loader-container";
export const projectClass = style.createClass("project", {
    display: "flex",
    flexDirection: "column",
    height: "100%",

    ".top-bar": {
        width: `calc(100% + ${spacing.m + spacing.s}px)`,
        paddingBottom: spacing.xs,

        h1: {
            fontSize: typography.m
        },

        p: {
            fontSize: typography.s
        },

        [`.${topBarActionsClass}`]: {
            [`.${loaderContainerClass}`]: {
                width: 38,
                height: 38,
                padding: 4
            }
        }
    }
});

export const leftPanelClass = style.createClass("left-panel", {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    width: fileTreePanelWidth,
    transition: "0.2s width",

    "> div:last-child": {
        paddingLeft: spacing.s,
        paddingBottom: spacing.s,
        transition: "0.2s all",

        "&.hide": {
            paddingLeft: 0,
            paddingBottom: 0,
            height: 0,
            overflow: "hidden"
        }
    }
});

export const fileAndEditorClosedClass = "closed-panel";
export const fileTreeAndEditorClass = style.createClass(
    "file-tree-and-editor",
    {
        flex: 1,
        overflow: "hidden",
        display: "flex",
        marginLeft: 0 - spacing.m,
        width: `calc(100% + ${spacing.m + spacing.m}px)`,

        [`&.${fileAndEditorClosedClass}`]: {
            [`.${leftPanelClass}`]: {
                width: 0,

                " > div:last-child": {
                    width: 0,
                    paddingLeft: 0
                }
            },

            [`.${workspaceClass}`]: {
                borderTopLeftRadius: 0
            }
        }
    }
);

export const gitWidgetClass = style.createClass("git-widget", {
    display: "flex",
    alignItems: "center",
    color: colors.blue.main,
    position: "relative",

    "> div:first-child": {
        textAlign: "right",
        display: "flex",
        flexDirection: "column",

        "> div:last-child": {
            fontSize: typography.s
        }
    }
});

export const gitStatusArrowRedClass = "red";
export const gitStatusArrowClass = style.createClass("git-status-arrow", {
    position: "absolute",
    color: colors.green,
    zIndex: 1,
    top: -1,
    right: -1,
    transform: "rotate(135deg)",
    height: 20,
    width: 20,

    [`&.${gitStatusArrowRedClass}`]: {
        color: colors.red,
        transform: "rotate(-45deg)"
    }
});
