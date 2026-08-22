import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
// Nếu project dùng Tailwind CSS, import file index.css có @tailwind directives ở đây, ví dụ:
import "./index.css";
import "./styles/theme.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
