import style from "style";
import spacing from "../style/spacing.s";

export const scrollableClass = "scrollable";
export const viewScrollableClass = style.createClass("view-scrollable", {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",

    [`.${scrollableClass}`]: {
        overflow: "auto",
        marginLeft: 0 - spacing.m,
        marginRight: 0 - spacing.m,
        marginBottom: 0 - spacing.m,
        paddingLeft: spacing.m,
        paddingRight: spacing.m,
        paddingBottom: spacing.m,
        display: "flex",
        flexDirection: "column",
        flex: 1
    }
});
