import style from "style";
import spacing, { maxWidth } from "../../style/spacing.s";

export const searchAndAddClass = style.createClass("search-and-add", {
    paddingTop: spacing.s,
    width: "100%",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.s,
    paddingBottom: spacing.m,
    "> form:first-child": {
        flex: 1,
        maxWidth
    }
});
