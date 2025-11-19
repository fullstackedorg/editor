import style, { CSSProperties } from "style";
import colors from "@fullstacked/ui/values/colors.s";
import spacing from "@fullstacked/ui/values/spacing.s";

const htmlBodyStyle: CSSProperties = {
    backgroundColor: colors.blue.dark,
    color: colors.light,
    margin: 0,
    width: "100%",
    height: "100%",
    WebkitTextSizeAdjust: "100%"
};

style.createGlobalStyle({
    html: htmlBodyStyle,
    body: htmlBodyStyle,

    ul: {
        margin: 0,
        padding: 0
    },

    ".winbox": {
        borderRadius: spacing.s,
        backgroundColor: colors.gray.dark,
        overflow: "hidden"
    }
});
