/*
 * Clickable profile picture: every click flips it to a random dog or fox.
 *
 * Pictures come from Dog CEO (https://dog.ceo/dog-api) and the Random Fox API
 * (https://randomfox.ca), both free, key-less and CORS-friendly, so the browser
 * can call them straight from the page.
 * If a service is unreachable the portrait simply stays in place.
 * Nothing is stored: any page navigation brings the portrait back.
 */
(function () {
  "use strict";

  var toggle = document.querySelector("[data-animal-avatar]");
  if (!toggle || !window.Promise || !window.fetch) {
    return;
  }

  var img = toggle.querySelector("img");
  var reset = document.querySelector("[data-animal-reset]");
  var portrait = { src: img.getAttribute("src"), alt: img.getAttribute("alt") };
  var flipMs = 320;
  var busy = false;

  var reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* each source answers with JSON; `pick` digs the picture URL out of it */
  var sources = [
    {
      kind: "dog",
      url: "https://dog.ceo/api/breeds/image/random",
      pick: function (data) {
        return data.message;
      }
    },
    {
      kind: "fox",
      url: "https://randomfox.ca/floof/",
      pick: function (data) {
        return data.image;
      }
    }
  ];

  function randomSource() {
    return sources[Math.floor(Math.random() * sources.length)];
  }

  function preload(src) {
    return new Promise(function (resolve, reject) {
      var probe = new Image();
      probe.onload = function () {
        resolve(src);
      };
      probe.onerror = function () {
        reject(new Error("could not load " + src));
      };
      probe.src = src;
    });
  }

  /* ask a source for a picture, and only resolve once it is ready to show */
  function fetchPicture(triesLeft) {
    var source = randomSource();
    return window
      .fetch(source.url, { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error(source.url + " answered " + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        var src = source.pick(data);
        if (!src) {
          throw new Error("no picture in the answer from " + source.url);
        }
        return preload(src);
      })
      .then(function (src) {
        return { kind: source.kind, src: src };
      })
      .catch(function (err) {
        if (triesLeft > 1) {
          return fetchPicture(triesLeft - 1);
        }
        throw err;
      });
  }

  function apply(src, alt, isRandom) {
    img.src = src;
    img.alt = alt;
    toggle.setAttribute(
      "aria-label",
      isRandom ? "A random animal. Click for another one." : "Show a random animal"
    );
    if (reset) {
      reset.hidden = !isRandom;
    }
  }

  /* swap the picture halfway through the flip, so it lands on the back face */
  function flipTo(src, alt, isRandom) {
    if (reduceMotion) {
      apply(src, alt, isRandom);
      return;
    }
    toggle.classList.add("is-flipping");
    window.setTimeout(function () {
      apply(src, alt, isRandom);
    }, flipMs / 2);
    window.setTimeout(function () {
      toggle.classList.remove("is-flipping");
    }, flipMs);
  }

  function showPicture() {
    if (busy) {
      return;
    }
    busy = true;
    toggle.classList.add("is-loading");

    fetchPicture(3)
      .then(function (picture) {
        flipTo(picture.src, "A random " + picture.kind, true);
      })
      .catch(function () {
        /* the services are unreachable: leave the current picture alone */
      })
      .then(function () {
        toggle.classList.remove("is-loading");
        window.setTimeout(function () {
          busy = false;
        }, reduceMotion ? 0 : flipMs);
      });
  }

  function showPortrait() {
    if (busy || img.getAttribute("src") === portrait.src) {
      return;
    }
    busy = true;
    flipTo(portrait.src, portrait.alt, false);
    window.setTimeout(function () {
      busy = false;
    }, reduceMotion ? 0 : flipMs);
  }

  toggle.addEventListener("click", showPicture);

  if (reset) {
    reset.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      showPortrait();
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      showPortrait();
    }
  });
})();
