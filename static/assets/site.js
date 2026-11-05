/* Monovus site navigation. The Offerings and Company menus are native <details>
   elements and work without this file; it only closes them on Escape, on a click
   outside, and when another menu opens. */
(function () {
  var menus = Array.prototype.slice.call(document.querySelectorAll(".dd details"));
  if (!menus.length) return;
  menus.forEach(function (d) {
    d.addEventListener("toggle", function () {
      if (d.open) menus.forEach(function (o) { if (o !== d) o.open = false; });
    });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    menus.forEach(function (d) {
      if (d.open) { d.open = false; d.querySelector("summary").focus(); }
    });
  });
  document.addEventListener("click", function (e) {
    menus.forEach(function (d) { if (d.open && !d.contains(e.target)) d.open = false; });
  });
})();
