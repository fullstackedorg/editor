import style from "style";
import spacing from "@fullstacked/ui/values/spacing.s";

export const searchAndAddClass = style.createClass("search-and-add", {
    paddingTop: spacing.s,
    width: "100%",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.s,
    paddingBottom: spacing.m
});

export const hideClass = style.createClass("hide", {
    display: "none"
});

export const searchFormClass = style.createClass("search-form", {
    display: "flex",
    gap: spacing.m,
    flex: 1,
    "> .input-text": {
        maxWidth: 400
    },
    "> .input-select": {
        maxWidth: 250
    }
});
