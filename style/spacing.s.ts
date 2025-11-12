import style, { CSSProperties } from "style";

export default {
    xs: 5,
    s: 10,
    m: 20,
    l: 30
};

export const maxWidth = 500;

const htmlBodyStyle: CSSProperties = {
    margin: 0,
    width: "100%",
    height: "100%"
};

style.createGlobalStyle({
    html: htmlBodyStyle,
    body: htmlBodyStyle
});
