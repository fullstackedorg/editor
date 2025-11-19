import style from "style";
import spacing from "@fullstacked/ui/values/spacing.s";

export const topBarNoBackClass = "no-back";
export const topBarTitlesClass = "titles";
export const topBarActionsClass = "top-bar-actions";
export const topBarClass = style.createClass("top-bar", {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: `calc(100% - ${spacing.m}px)`,
    marginLeft: 0 - spacing.m,
    [`&.${topBarNoBackClass}`]: {
        width: "100%",
        marginLeft: 0
    },
    "> div:first-child": {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        overflow: "hidden",
        flex: 1,
        [`.${topBarTitlesClass}`]: {
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
            "> *": {
                width: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis"
            }
        }
    },
    "> div:last-child": {
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: spacing.s
    }
});
