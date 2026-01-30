import style from "style";
import spacing from "@fullstacked/ui/values/spacing.s";
import breakpoints from "@fullstacked/ui/values/breakpoints.s";
import { color } from "@codemirror/theme-one-dark";
import colors from "@fullstacked/ui/values/colors.s";

export const searchAndAddClass = style.createClass("search-and-add", {
    paddingTop: spacing.s,
    width: "100%",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingBottom: spacing.m,
    gap: spacing.s
});

export const hideClass = "hide";
export const redBadgeClass = "red-badge";
export const buttonContainer = style.createClass("button-container", {
    position: "relative",
    display: "none",
    marginRight: 0 - spacing.m,
    [`@media (max-width: ${breakpoints.m}px)`]: {
        display: "block"
    },
    [`.${redBadgeClass}`]: {
        height: 8,
        width: 8,
        borderRadius: "50%",
        backgroundColor: colors.red,
        position: "absolute",
        top: 4,
        right: 2,
        [`&.${hideClass}`]: {
            display: "none"
        }
    },
    [`&.${hideClass}`]: {
        display: "none"
    }
});
export const searchFormClass = style.createClass("search-form", {
    display: "flex",
    gap: spacing.m,
    flex: 1,
    alignItems: "flex-end",
    marginBottom: 0,

    "> .input-text": {
        maxWidth: 400,
        width: "auto",
        flex: 1
    },
    "> .input-select": {
        maxWidth: 250,
        [`@media (max-width: ${breakpoints.m}px)`]: {
            width: 0,
            overflow: "hidden",
            height: 20
        },
        [`&.${hideClass}`]: {
            display: "none"
        }
    },

    [`@media (max-width: ${breakpoints.m}px)`]: {
        gap: spacing.s
    }
});
