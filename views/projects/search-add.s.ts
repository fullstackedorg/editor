import style from "style";
import spacing from "@fullstacked/ui/values/spacing.s";
import breakpoints from "@fullstacked/ui/values/breakpoints.s";

export const searchAndAddClass = style.createClass("search-and-add", {
    paddingTop: spacing.s,
    width: "100%",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.s,
    paddingBottom: spacing.m
});

export const hideClass = "hide";
export const searchFormClass = style.createClass("search-form", {
    display: "flex",
    gap: spacing.m,
    flex: 1,
    alignItems: "flex-end",
    "> .input-text": {
        maxWidth: 400,
        width: "auto",
        flex: 1,
    },
    "> .input-select": {
        maxWidth: 250,
        [`@media (max-width: ${breakpoints.m}px)`]: {
            display: "none"
        },
        [`&.${hideClass}`]: {
            display: "none"
        },
    }
});
