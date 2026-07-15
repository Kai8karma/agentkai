/*
 * main.js — page interactions for the gtmos landing page.
 * Vanilla JS, zero dependencies: scroll reveals, hero CLI typing effect,
 * and IntersectionObserver-gated demo video playback.
 */
(function () {
  'use strict';

  var reducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- scroll reveal ----------
  var revealEls = document.querySelectorAll('.reveal');

  if (reducedMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('visible'); });
  } else {
    var revealObserver = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  }

  // ---------- hero terminal typing effect ----------
  var typedEl = document.getElementById('typed-cmd');
  var cursorEl = document.getElementById('cursor');
  var outputEl = document.getElementById('terminal-output');
  var COMMAND = 'gtmos quickstart';

  function revealOutput() {
    if (outputEl) outputEl.hidden = false;
    if (cursorEl) cursorEl.style.display = 'none';
  }

  if (typedEl) {
    if (reducedMotion) {
      typedEl.textContent = COMMAND;
      revealOutput();
    } else {
      var i = 0;
      var typeStep = function () {
        if (i <= COMMAND.length) {
          typedEl.textContent = COMMAND.slice(0, i);
          i += 1;
          setTimeout(typeStep, 55);
        } else {
          setTimeout(revealOutput, 500);
        }
      };
      setTimeout(typeStep, 600);
    }
  }

  // ---------- demo video: play only while in view ----------
  var video = document.getElementById('demo-video');
  if (video) {
    if (reducedMotion) {
      video.removeAttribute('autoplay');
    } else if ('IntersectionObserver' in window) {
      var videoObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              video.play().catch(function () {
                /* autoplay may be blocked; user can use native controls */
              });
            } else {
              video.pause();
            }
          });
        },
        { threshold: 0.35 }
      );
      videoObserver.observe(video);
    }
  }
})();
