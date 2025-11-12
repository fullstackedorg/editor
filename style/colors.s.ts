import style, { CSSProperties } from "style";

const colors = {
    blue: {
        main: "#007aff",
        accent: "#04b8ec",
        dark: "#1e293b"
    },
    dark: "#15171b",
    red: "#ff453a",
    green: "#30d158",
    yellow: "#ffcc00",
    light: "#ffffff",
    gray: {
        main: "#8c929b",
        dark: "#404958"
    },
    overlay: "#15171b99"
};

export default colors;

export function opacity(color: string, opacity: number) {
    return [
        "rgba(" + parseInt(color.slice(1, 3), 16),
        parseInt(color.slice(3, 5), 16),
        parseInt(color.slice(5), 16),
        opacity / 100 + ")"
    ].join(",");
}

const htmlBodyStyle: CSSProperties = {
    backgroundColor: colors.blue.dark,
    color: colors.light
};

style.createGlobalStyle({
    html: htmlBodyStyle,
    body: htmlBodyStyle
});
