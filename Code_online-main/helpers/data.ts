// helpers/data.ts

interface FileData {
  name: string;
  iconName: string;
  language: string;
  iconColor: string;
  code: string;
}

export const dummyFilesData: Record<string, FileData> = {
  "index.html": {
    name: "index.html",
    iconName:
      "https://upload.wikimedia.org/wikipedia/commons/6/61/HTML5_logo_and_wordmark.svg",
    language: "html",
    iconColor: "red",
    code: "",
  },
  "script.js": {
    name: "script.js",
    iconName:
      "https://upload.wikimedia.org/wikipedia/commons/9/99/Unofficial_JavaScript_logo_2.svg",
    language: "javascript",
    iconColor: "yellow",
    code: "",
  },
  "style.css": {
    name: "style.css",
    iconName:
      "https://upload.wikimedia.org/wikipedia/commons/d/d5/CSS3_logo_and_wordmark.svg",
    language: "css",
    iconColor: "blue",
    code: "",
  },
};
