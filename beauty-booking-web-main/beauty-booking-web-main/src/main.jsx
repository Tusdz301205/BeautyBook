import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
// Nếu project dùng Tailwind CSS, import file index.css có @tailwind directives ở đây, ví dụ:
import "./index.css";
import "./styles/theme.css";

// Khi một bản build mới thay thế các route chunk cũ, tự tải lại đúng một lần
// thay vì để người dùng gặp màn hình trắng khi chuyển trang.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const reloadKey = "bb:chunk-reload-at";
  const lastReload = Number(window.sessionStorage.getItem(reloadKey) || 0);
  if (Date.now() - lastReload < 10_000) return;
  window.sessionStorage.setItem(reloadKey, String(Date.now()));
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
