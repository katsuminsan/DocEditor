from doceditor.api import Api

try:
    import webview
except ImportError as exc:
    raise SystemExit("pywebview is required. Install with: pip install -r requirements.txt") from exc


def main():
    api = Api()
    window = webview.create_window(
        "DocEditor",
        "frontend/index.html",
        js_api=api,
        width=1280,
        height=860,
        min_size=(960, 640),
    )
    api.window = window
    webview.start(debug=False)


if __name__ == "__main__":
    main()
