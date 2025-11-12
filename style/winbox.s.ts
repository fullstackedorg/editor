import style from "style";
import spacing from "./spacing.s";
import colors from "./colors.s";

style.createGlobalStyle({
    ".winbox": {
        borderRadius: spacing.s,
        backgroundColor: colors.gray.dark,
        overflow: "hidden"
    }
});
