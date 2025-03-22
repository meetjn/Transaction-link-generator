import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

// Add global error handler to catch and log unhandled errors
const globalErrorHandler = (event: ErrorEvent) => {
  // Prevent the default browser error handling
  event.preventDefault();

  // Log the error details to console
  console.error("Unhandled error:", event.error || event.message);

  // You could also log to an error monitoring service here
};

// Set up the error handler
window.addEventListener("error", globalErrorHandler);

// Set up unhandled promise rejection handler
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
});

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
