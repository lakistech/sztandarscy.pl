(function () {
  'use strict';

  var CMS_URL = 'https://cms.sztandarscy.pl';
  var HERO_INTERVAL_MS = 6000;
  var PROPERTY = document.body.getAttribute('data-property') || 'sarbsk';

  document.getElementById('year').textContent = new Date().getFullYear();

  function fetchWithRetry(url, attemptsLeft) {
    return fetch(url, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('CMS request failed: ' + res.status);
        return res.json();
      })
      .catch(function (err) {
        if (attemptsLeft > 0) {
          return new Promise(function (resolve) {
            setTimeout(resolve, 900);
          }).then(function () {
            return fetchWithRetry(url, attemptsLeft - 1);
          });
        }
        throw err;
      });
  }

  function fetchContent() {
    return fetchWithRetry(CMS_URL + '/api/' + PROPERTY, 2).catch(function (err) {
      console.warn('Nie udalo sie pobrac tresci z CMS:', err);
      return null;
    });
  }

  function applyTexts(content) {
    var texts = content.texts || {};

    if (texts.seo_title) document.title = texts.seo_title;
    if (texts.seo_description) {
      var meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', texts.seo_description);
    }

    Object.keys(texts).forEach(function (name) {
      var value = texts[name];
      if (!value) return;
      document.querySelectorAll('[data-field="' + name + '"]').forEach(function (el) {
        el.textContent = value;
      });
    });

    if (texts.contact_phone) {
      var telHref = 'tel:' + texts.contact_phone.replace(/[^+0-9]/g, '');
      document.querySelectorAll('a[data-tel-link]').forEach(function (a) { a.href = telHref; });
    }
    if (texts.contact_email) {
      var mailHref = 'mailto:' + texts.contact_email;
      document.querySelectorAll('a[data-email-link]').forEach(function (a) { a.href = mailHref; });
    }

    if (content.about_features && content.about_features.length) {
      var list = document.querySelector('[data-field-list="about_features"]');
      if (list) {
        list.innerHTML = '';
        content.about_features.forEach(function (text) {
          var li = document.createElement('li');
          li.textContent = text;
          list.appendChild(li);
        });
      }
    }

    if (content.area_cards && content.area_cards.length) {
      var cardsWrap = document.querySelector('[data-field-list="area_cards"]');
      if (cardsWrap) {
        cardsWrap.innerHTML = '';
        content.area_cards.forEach(function (card) {
          var div = document.createElement('div');
          div.className = 'card';
          var h3 = document.createElement('h3');
          h3.textContent = card.title;
          var p = document.createElement('p');
          p.textContent = card.text;
          div.appendChild(h3);
          div.appendChild(p);
          cardsWrap.appendChild(div);
        });
      }
    }
  }

  function initAboutPhoto(photo) {
    if (!photo) return;
    var frame = document.getElementById('hero-photo-frame');
    var img = document.createElement('img');
    img.src = photo.url;
    img.alt = photo.alt;
    frame.innerHTML = '';
    frame.appendChild(img);
  }

  function initHero(photos) {
    var container = document.getElementById('hero-slides');
    if (!photos.length) return;

    container.innerHTML = '';
    photos.forEach(function (photo, i) {
      var div = document.createElement('div');
      div.className = 'hero__slide' + (i === 0 ? ' is-active' : '');
      div.style.backgroundImage = 'url(' + photo.url + ')';
      container.appendChild(div);
    });

    if (photos.length > 1) {
      var current = 0;
      setInterval(function () {
        var slides = container.querySelectorAll('.hero__slide');
        slides[current].classList.remove('is-active');
        current = (current + 1) % slides.length;
        slides[current].classList.add('is-active');
      }, HERO_INTERVAL_MS);
    }
  }

  var lightboxPhotos = [];
  var lightboxIndex = 0;

  function initGallery(photos) {
    lightboxPhotos = photos;
    var grid = document.getElementById('gallery-grid');
    var empty = document.getElementById('gallery-empty');
    if (!photos.length) return;

    empty.remove();
    photos.forEach(function (photo, index) {
      var item = document.createElement('div');
      item.className = 'gallery__item';
      var img = document.createElement('img');
      img.src = photo.thumb || photo.url;
      img.alt = photo.alt;
      img.loading = 'lazy';
      item.appendChild(img);
      item.addEventListener('click', function () { openLightbox(index); });
      grid.appendChild(item);
    });
  }

  function showLightboxPhoto(index) {
    var len = lightboxPhotos.length;
    if (!len) return;
    lightboxIndex = (index % len + len) % len;
    var photo = lightboxPhotos[lightboxIndex];
    var img = document.getElementById('lightbox-img');
    img.src = photo.url;
    img.alt = photo.alt;
  }

  function openLightbox(index) {
    showLightboxPhoto(index);
    document.getElementById('lightbox').classList.add('is-open');
  }

  function closeLightbox() {
    document.getElementById('lightbox').classList.remove('is-open');
  }

  function nextLightboxPhoto() { showLightboxPhoto(lightboxIndex + 1); }
  function prevLightboxPhoto() { showLightboxPhoto(lightboxIndex - 1); }

  var lightboxEl = document.getElementById('lightbox');

  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox-next').addEventListener('click', function (e) {
    e.stopPropagation();
    nextLightboxPhoto();
  });
  document.getElementById('lightbox-prev').addEventListener('click', function (e) {
    e.stopPropagation();
    prevLightboxPhoto();
  });
  lightboxEl.addEventListener('click', function (e) {
    if (e.target.id === 'lightbox') closeLightbox();
  });
  document.addEventListener('keydown', function (e) {
    if (!lightboxEl.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') nextLightboxPhoto();
    if (e.key === 'ArrowLeft') prevLightboxPhoto();
  });

  (function () {
    var touchStartX = null;
    lightboxEl.addEventListener('touchstart', function (e) {
      touchStartX = e.changedTouches[0].clientX;
    }, { passive: true });
    lightboxEl.addEventListener('touchend', function (e) {
      if (touchStartX === null) return;
      var dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) {
        if (dx < 0) nextLightboxPhoto(); else prevLightboxPhoto();
      }
      touchStartX = null;
    }, { passive: true });
  })();

  fetchContent().then(function (content) {
    if (!content) return;
    initHero(content.bg || []);
    initAboutPhoto(content.about);
    initGallery(content.gallery || []);
    applyTexts(content);
  });
})();
