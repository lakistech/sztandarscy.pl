(function () {
  'use strict';

  var STRAPI_URL = 'https://strapi.lakis.pro';
  var HERO_INTERVAL_MS = 6000;
  var PROPERTY = document.body.getAttribute('data-property') || 'sarbsk';
  var ENDPOINT = PROPERTY === 'leba' ? 'photo-lebas' : 'photo-sarbsks';
  var PAGE_ENDPOINT = PROPERTY === 'leba' ? 'page-leba' : 'page-sarbsk';

  document.getElementById('year').textContent = new Date().getFullYear();

  function absoluteUrl(url) {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    return STRAPI_URL + url;
  }

  function fetchWithRetry(url, attemptsLeft) {
    return fetch(url, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('Strapi request failed: ' + res.status);
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

  function fetchPhotos(section) {
    var url = STRAPI_URL + '/api/' + ENDPOINT + '?populate=image&sort=order:asc'
      + '&filters[section][$eq]=' + encodeURIComponent(section);
    return fetchWithRetry(url, 2)
      .then(function (json) {
        return (json.data || []).map(function (item) {
          var img = item.image;
          var fmt = img && img.formats && img.formats.large ? img.formats.large : img;
          return {
            url: absoluteUrl(fmt && fmt.url),
            alt: item.title || 'Sztandarscy',
          };
        }).filter(function (p) { return !!p.url; });
      })
      .catch(function (err) {
        console.warn('Nie udalo sie pobrac zdjec z Strapi:', err);
        return [];
      });
  }

  var TEXT_FIELDS = [
    'nav_brand', 'nav_subtitle', 'nav_switch_label', 'nav_cta_label',
    'hero_eyebrow', 'hero_title', 'hero_lead', 'hero_cta_primary', 'hero_cta_secondary',
    'about_eyebrow', 'about_title', 'about_paragraph_1', 'about_paragraph_2',
    'gallery_eyebrow', 'gallery_title', 'gallery_intro',
    'area_eyebrow', 'area_title',
    'contact_eyebrow', 'contact_title', 'contact_intro',
    'contact_phone', 'contact_email', 'contact_address',
    'contact_card_name', 'contact_card_text', 'contact_card_button',
    'crosslink_title', 'crosslink_text', 'crosslink_button',
    'footer_text'
  ];

  function fetchPageContent() {
    var url = STRAPI_URL + '/api/' + PAGE_ENDPOINT + '?populate=*';
    return fetchWithRetry(url, 2)
      .then(function (json) { return json.data; })
      .catch(function (err) {
        console.warn('Nie udalo sie pobrac tresci strony:', err);
        return null;
      });
  }

  function applyPageContent(content) {
    if (!content) return;

    if (content.seo_title) document.title = content.seo_title;
    if (content.seo_description) {
      var meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', content.seo_description);
    }

    TEXT_FIELDS.forEach(function (name) {
      var value = content[name];
      if (value === undefined || value === null || value === '') return;
      var el = document.querySelector('[data-field="' + name + '"]');
      if (el) el.textContent = value;
    });

    if (content.contact_phone) {
      var telHref = 'tel:' + content.contact_phone.replace(/\s+/g, '');
      document.querySelectorAll('a[data-tel-link]').forEach(function (a) { a.href = telHref; });
    }
    if (content.contact_email) {
      var mailHref = 'mailto:' + content.contact_email;
      document.querySelectorAll('a[data-email-link]').forEach(function (a) { a.href = mailHref; });
    }

    if (content.about_features && content.about_features.length) {
      var list = document.querySelector('[data-field-list="about_features"]');
      if (list) {
        list.innerHTML = '';
        content.about_features.forEach(function (item) {
          var li = document.createElement('li');
          li.textContent = item.text;
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

  function initHero(photos) {
    var container = document.getElementById('hero-slides');
    var frame = document.getElementById('hero-photo-frame');
    if (!photos.length) return;

    container.innerHTML = '';
    photos.forEach(function (photo, i) {
      var div = document.createElement('div');
      div.className = 'hero__slide' + (i === 0 ? ' is-active' : '');
      div.style.backgroundImage = 'url(' + photo.url + ')';
      container.appendChild(div);
    });

    frame.innerHTML = '<img src="' + photos[0].url + '" alt="' + photos[0].alt + '">';

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
      img.src = photo.url;
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

  Promise.all([fetchPhotos('hero'), fetchPhotos('galeria'), fetchPageContent()]).then(function (results) {
    initHero(results[0]);
    initGallery(results[1]);
    applyPageContent(results[2]);
  });
})();
