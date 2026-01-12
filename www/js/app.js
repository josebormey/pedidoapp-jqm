/* Catalogo Multimedia - jQuery Mobile + JSON (offline-first) */
(function() {
  var PRODUCTS = [];
  var CURRENT = null;

  // Utilidad: carga JSON local
  function loadJSON(path) {
    return $.ajax({ url: path, dataType: 'json', cache: false });
  }

  // Render categorías únicas en el select
  function renderCategories(products) {
    var cats = Array.from(new Set(products.flatMap(p => p.categories || []))).sort();
    var $sel = $('#category');
    $sel.empty().append('<option value="">Todas</option>');
    cats.forEach(c => $sel.append('<option value="'+c+'">'+c+'</option>'));
    $sel.selectmenu('refresh', true);
  }

  // Render lista de productos
  function renderList() {
    var term = ($('#search').val() || '').toLowerCase().trim();
    var cat = $('#category').val() || '';
    var $list = $('#product-list');
    $list.empty();

    PRODUCTS.forEach(function(p) {
      var matchesTerm = !term ||
        (p.name && p.name.toLowerCase().includes(term)) ||
        (p.description && p.description.toLowerCase().includes(term)) ||
        ((p.categories || []).join(' ').toLowerCase().includes(term));

      var matchesCat = !cat || (p.categories || []).includes(cat);

      if (!matchesTerm || !matchesCat) return;

      var thumb = (p.images && p.images[0]) ? p.images[0] : 'img/placeholder.png';
      var li = $(
        '<li>' +
          '<a href="#detalle" data-id="'+p.id+'">' +
            '<img src="'+thumb+'" class="ui-li-thumb" alt="'+(p.name||'')+'">' +
            '<h2>'+ (p.name || 'Sin nombre') +'</h2>' +
            (p.price ? '<p class="price">'+ formatMoney(p.price) +'</p>' : '') +
            ((p.categories && p.categories.length) ? '<p class="cats">'+ p.categories.join(', ') +'</p>' : '') +
          '</a>' +
        '</li>'
      );

      // Navegación al detalle
      li.find('a').on('click', function() {
        var id = $(this).data('id');
        CURRENT = PRODUCTS.find(x => x.id === id);
        renderDetail();
      });

      $list.append(li);
    });

    $list.listview('refresh');
  }

  // Render detalle de producto
  function renderDetail() {
    if (!CURRENT) return;

    // Header
    $('#detail-header').html(
      '<h2>'+ (CURRENT.name || 'Sin nombre') +'</h2>' +
      (CURRENT.price ? '<p class="price">'+ formatMoney(CURRENT.price) +'</p>' : '') +
      ((CURRENT.categories && CURRENT.categories.length) ? '<p class="cats">'+ CURRENT.categories.join(', ') +'</p>' : '')
    );

    // Descripción
    $('#detail-description').html(
      CURRENT.description ? '<p>'+ CURRENT.description +'</p>' : '<p><em>Sin descripción</em></p>'
    );

    // Imágenes
    var $imgs = $('#detail-images').empty();
    if (CURRENT.images && CURRENT.images.length) {
      CURRENT.images.forEach(function(src) {
        $imgs.append(
          '<div class="gallery-item">' +
            '<img src="'+src+'" alt="imagen" />' +
          '</div>'
        );
      });
    } else {
      $imgs.html('<p><em>No hay imágenes</em></p>');
    }

    // Videos
    var $vids = $('#detail-videos').empty();
    if (CURRENT.videos && CURRENT.videos.length) {
      CURRENT.videos.forEach(function(src) {
        $vids.append(
          '<div class="video-item">' +
            '<video controls preload="metadata" width="100%">' +
              '<source src="'+src+'" type="video/mp4">' +
              'Tu dispositivo no soporta video.' +
            '</video>' +
          '</div>'
        );
      });
    } else {
      $vids.html('<p><em>No hay videos</em></p>');
    }

    // Audios
    var $aud = $('#detail-audios').empty();
    if (CURRENT.audios && CURRENT.audios.length) {
      CURRENT.audios.forEach(function(src) {
        $aud.append(
          '<div class="audio-item">' +
            '<audio controls preload="metadata">' +
              '<source src="'+src+'" type="audio/mpeg">' +
              'Tu dispositivo no soporta audio.' +
            '</audio>' +
          '</div>'
        );
      });
    } else {
      $aud.html('<p><em>No hay audios</em></p>');
    }
  }

  // Formato de dinero simple
  function formatMoney(n) {
    return 'CUP ' + Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Eventos de filtros
  $(document).on('pageinit', '#catalogo', function() {
    $('#search').on('input', renderList);
    $('#category').on('change', renderList);
  });

  // Carga inicial de datos y render
  $(document).on('pageshow', '#catalogo', function() {
    if (PRODUCTS.length) {
      renderList();
      return;
    }
    loadJSON('data/products.json')
      .done(function(data) {
        PRODUCTS = Array.isArray(data) ? data : (data.products || []);
        renderCategories(PRODUCTS);
        renderList();
      })
      .fail(function() {
        PRODUCTS = [];
        renderCategories(PRODUCTS);
        renderList();
        alert('No se pudo cargar el catálogo. Verifique data/products.json');
      });
  });

  // Re-render detalle al entrar en la página
  $(document).on('pageshow', '#detalle', function() {
    renderDetail();
  });
})();
