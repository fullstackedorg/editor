import style, { CSSProperties } from "style";
import typography from "../../../../style/typography.s";
import spacing, { maxWidth } from "../../../../style/spacing.s";
import colors, { opacity } from "../../../../style/colors.s";

const smallMargins: CSSProperties = {
    marginTop: spacing.s,
    marginBottom: spacing.s
};

const lists: CSSProperties = {
    paddingLeft: spacing.l,

    li: {
        marginTop: spacing.xs,
        marginBottom: spacing.xs
    }
};

export const chatInfoClass = "infos";
export const chatAgentSelectorClass = "ai-agent-selector";
export const chatViewClass = style.createClass("chat-container", {
    display: "flex",
    justifyContent: "center",
    height: "100%",
    flexDirection: "column",
    position: "relative",

    [`.${chatInfoClass}`]: {
        fontSize: typography.s,
        padding: spacing.xs,
        borderBottom: `1px solid ${colors.gray.main}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
    },

    [`.${chatAgentSelectorClass}`]: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        padding: spacing.s,
        width: "100%",
        maxWidth,
        margin: "0 auto",

        ".ai-agent-configurator": {
            paddingBottom: spacing.s
        }
    },

    ".conversation": {
        width: "100%",
        flex: "1",
        overflow: "auto",

        ".messages": {
            display: "flex",
            flexDirection: "column",
            gap: spacing.s,
            marginTop: spacing.s,
            marginBottom: 80,

            "> div": {
                maxWidth: 800,
                paddingLeft: spacing.s,
                paddingRight: spacing.s,

                "&.human": {
                    alignSelf: "flex-end"
                },

                img: {
                    width: "100%",
                    objectFit: "contain"
                },

                p: smallMargins,
                h1: smallMargins,
                h2: smallMargins,
                h3: smallMargins,
                h4: smallMargins,
                h5: smallMargins,
                h6: smallMargins,

                code: {
                    backgroundColor: colors.gray.dark,
                    padding: "2px 5px",
                    borderRadius: 5,
                    fontSize: `calc(${typography.m} - 1px)`
                },

                ul: lists,
                ol: lists
            }
        },

        ".input": {
            backgroundColor: colors.gray.dark,
            padding: spacing.s,
            borderRadius: spacing.xs,
            width: `calc(100% - 40px)`,
            maxWidth: 800,
            margin: spacing.m,
            position: "absolute",
            bottom: 0,
            left: "50%",
            transform: `translateX(calc(-50% - ${spacing.m}px))`,
            border: `1px solid ${colors.gray.main}`,
            boxShadow: `0 0 30px 20px ${opacity(colors.dark, 30)}`,

            "&:focus-visible": {
                outline: `2px solid ${colors.blue.main}`,
                outlineOffset: 3
            }
        }
    }
});
