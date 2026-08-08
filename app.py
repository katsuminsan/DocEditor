import webview

from doceditor.api import Api


def main():
    api = Api()
    webview.create_window(
        "DocEditor",
        "frontend/index.html",
        js_api=api,
        width=1320,
        height=900,
        min_size=(1024, 680),
    )
    webview.start(debug=False)


if __name__ == "__main__":
    main()
