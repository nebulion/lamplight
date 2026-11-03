/* The site's own dialogs (2026-11-02, he asked: nothing from the browser, drawn like the right-click menu).
   Ask.text({ title, value, placeholder, ok }) resolves to the typed text, or null if cancelled.
   Ask.yes({ title, note, ok, no }) resolves to true or false.
   It opens near the last click. Enter accepts, Esc or a click outside cancels. Keys don't reach the page behind it. */
(function () {
"use strict";
var lastX = 0, lastY = 0, isOpen = false;
document.addEventListener("mousedown", function (e) { if (!e.target.closest(".askbox")) { lastX = e.clientX; lastY = e.clientY; } }, true);
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

function open(html, onDone, focusSel) {
  isOpen = true;
  var back = document.createElement("div"), box = document.createElement("div");
  back.className = "askback";
  box.className = "askbox"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
  box.innerHTML = html;
  back.appendChild(box); document.body.appendChild(back);
  var w = box.offsetWidth, h = box.offsetHeight;
  var x = lastX || (innerWidth - w) / 2, y = lastY || innerHeight / 3;
  box.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + "px";
  box.style.top = Math.max(8, Math.min(y, innerHeight - h - 8)) + "px";
  try { box.animate([{ opacity: 0, transform: "translateY(-3px)" }, { opacity: 1, transform: "none" }], { duration: 110, easing: "ease-out" }); } catch (e) {}
  var before = document.activeElement;
  function close(answer) {
    if (!isOpen) return;
    isOpen = false; back.remove();
    if (before && before.focus && document.contains(before)) before.focus();
    onDone(answer);
  }
  back.addEventListener("mousedown", function (e) { if (e.target === back) close(undefined); });
  box.addEventListener("click", function (e) {
    var b = e.target.closest("[data-ask]"); if (!b) return;
    close(b.getAttribute("data-ask") === "ok" ? true : undefined);
  });
  back.addEventListener("keydown", function (e) {
    e.stopPropagation();
    if (e.key === "Escape") { e.preventDefault(); close(undefined); }
    else if (e.key === "Enter" && e.target.tagName !== "BUTTON") { e.preventDefault(); close(true); }
  });
  var f = box.querySelector(focusSel); if (f) { f.focus(); if (f.select) f.select(); }
  return box;
}

window.Ask = {
  text: function (o) {
    return new Promise(function (resolve) {
      var box = open('<p class="ask-t">' + esc(o.title) + "</p>" +
        '<input class="ask-in" type="text" value="' + esc(o.value || "") + '" placeholder="' + esc(o.placeholder || "") + '" aria-label="' + esc(o.title) + '">' +
        '<div class="ask-b"><button type="button" class="btn primary" data-ask="ok">' + esc(o.ok || "OK") + '</button><button type="button" class="btn" data-ask="no">Cancel</button></div>',
        function (ok) { resolve(ok ? input.value : null); }, ".ask-in");
      var input = box.querySelector(".ask-in");
    });
  },
  yes: function (o) {
    return new Promise(function (resolve) {
      open('<p class="ask-t">' + esc(o.title) + "</p>" + (o.note ? '<p class="ask-n">' + esc(o.note) + "</p>" : "") +
        '<div class="ask-b"><button type="button" class="btn primary" data-ask="ok">' + esc(o.ok || "Yes") + '</button><button type="button" class="btn" data-ask="no">' + esc(o.no || "Cancel") + "</button></div>",
        function (ok) { resolve(!!ok); }, ".btn.primary");
    });
  }
};
})();
