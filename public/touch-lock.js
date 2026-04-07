(function () {
  var startX = 0, startY = 0, lockH = false, decided = false;

  document.addEventListener('touchstart', function (e) {
    var t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    lockH  = false;
    decided = false;
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (decided && !lockH) return;
    var dx = Math.abs(e.touches[0].clientX - startX);
    var dy = Math.abs(e.touches[0].clientY - startY);

    if (!decided && (dx > 4 || dy > 4)) {
      decided = true;
      lockH = dx > dy;
    }

    if (lockH) {
      e.preventDefault();
    }
  }, { passive: false });

  document.addEventListener('touchend',    function () { lockH = false; decided = false; }, { passive: true });
  document.addEventListener('touchcancel', function () { lockH = false; decided = false; }, { passive: true });
})();
