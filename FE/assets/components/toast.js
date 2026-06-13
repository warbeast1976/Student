export function toast(message, type = "success") {
  const root = document.getElementById("toast-root");
  if (!root) return;

  const node = document.createElement("div");
  node.className = `toast ${type}`;

  const strong = document.createElement("strong");
  strong.textContent = type === "error" ? "Error: " : "Success: ";

  const text = document.createElement("span");
  text.textContent = message;

  node.appendChild(strong);
  node.appendChild(text);
  root.appendChild(node);

  setTimeout(() => {
    node.remove();
  }, 2800);
}
