import style from "style";
import spacing from "../../../style/spacing.s";
import colors from "../../../style/colors.s";

export const fileTreePanelWidth = 235;
const workspaceTabsHeight = 34;

export const workspaceClass = style.createClass("workspace", {
    width: `calc(100% - ${fileTreePanelWidth}px)`,
    borderTopLeftRadius: spacing.xs,
    transition: "0.2s width",
    flex: 1,
    backgroundColor: colors.dark,
    height: "100%",
    display: "flex",
    flexDirection: "column",

    "> div:first-child": {
        display: "flex",
        borderBottom: `1px solid ${colors.gray.main}`,
        height: workspaceTabsHeight,
        alignItems: "center"
    }
});
