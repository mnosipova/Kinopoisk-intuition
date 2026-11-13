/* ============================================================
   Угадай рейтинг — игровая логика
   ============================================================ */
(function () {
  'use strict';

  var ROUNDS = 10;
  var MAX_POINTS = 1000;      // за один раунд при ошибке 0.0
  var RANGE_MIN = 7.0;
  var RANGE_MAX = 10.0;

  // --- DOM ---
  var $ = function (id) { return document.getElementById(id); };
  var screens = { home: $('screen-home'), game: $('screen-game'), final: $('screen-final') };
  var slider = $('slider');
  var poster = $('poster');

  // --- Состояние игры ---
  var deck = [];        // 10 сериалов этой игры
  var round = 0;        // индекс текущего раунда (0-based)
  var answered = false;
  var results = [];     // {user, real, diffSigned, diffAbs, points}

  // ---------- Утилиты ----------
  function fmt1(n) {
    return (Math.round(n * 10) / 10).toFixed(1);
  }
  function fmtSigned(n) {
    var v = Math.round(n * 10) / 10;
    if (v > 0) return '+' + v.toFixed(1);
    if (v < 0) return '−' + Math.abs(v).toFixed(1);
    return '0.0';
  }
  function fmtNum(n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  }
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  // Точная работа в десятых долях, чтобы избежать 0.30000000004
  function tenths(x) { return Math.round(x * 10); }
  function pointsFor(user, real) {
    var d = Math.abs(tenths(user) - tenths(real));
    return Math.max(0, MAX_POINTS - d * 100);
  }

  // ---------- Экраны ----------
  function showScreen(name) {
    Object.keys(screens).forEach(function (k) {
      screens[k].classList.toggle('active', k === name);
    });
    window.scrollTo(0, 0);
  }

  // ---------- Прогресс ----------
  function renderProgress() {
    $('round-label').textContent = 'Раунд ' + (round + 1) + ' из ' + ROUNDS;
    var bar = $('progress-bar');
    bar.innerHTML = '';
    for (var i = 0; i < ROUNDS; i++) {
      var cell = document.createElement('div');
      cell.className = 'p-cell' + (i < round ? ' done' : i === round ? ' current' : '');
      bar.appendChild(cell);
    }
    var total = results.reduce(function (s, r) { return s + r.points; }, 0);
    $('score-mini').textContent = fmtNum(total);
  }

  // ---------- Раунд ----------
  function renderRound() {
    var s = deck[round];
    answered = false;

    poster.style.opacity = '0';
    poster.onload = function () { poster.style.transition = 'opacity .4s ease'; poster.style.opacity = '1'; };
    poster.src = s.image;
    poster.alt = 'Обложка сериала «' + s.title + '»';

    $('s-title').textContent = s.title;
    $('s-years').textContent = s.years;
    $('s-genre').textContent = [s.country, s.genre].filter(Boolean).join(' • ');
    $('s-director').textContent = s.director ? 'Режиссёр: ' + s.director : '';
    $('s-actors').textContent = s.actors ? 'В ролях: ' + s.actors : '';

    // предзагрузка обложки следующего раунда
    if (round + 1 < deck.length) {
      var pre = new Image();
      pre.src = deck[round + 1].image;
    }

    slider.disabled = false;
    slider.value = '8';
    updateSlider(true);
    $('guess-value').textContent = fmt1(8);

    $('result').hidden = true;
    $('btn-guess').hidden = false;
    $('btn-guess').disabled = false;

    renderProgress();
  }

  function updateSlider(skipAnim) {
    var v = parseFloat(slider.value);
    var min = parseFloat(slider.min);
    var max = parseFloat(slider.max);
    var pct = ((v - min) / (max - min)) * 100;
    var track = 'linear-gradient(90deg, var(--accent) ' + pct + '%, #2b2b33 ' + pct + '%)';
    slider.style.setProperty('--track', track);
    if (!skipAnim) {
      var gv = $('guess-value');
      gv.classList.add('tick');
      setTimeout(function () { gv.classList.remove('tick'); }, 120);
    }
  }

  slider.addEventListener('input', function () {
    if (answered) return;
    $('guess-value').textContent = fmt1(parseFloat(slider.value));
    updateSlider(false);
  });

  // ---------- Ответ ----------
  $('btn-guess').addEventListener('click', function () {
    if (answered || !deck.length || round >= deck.length) return;
    answered = true;

    var s = deck[round];
    var user = parseFloat(slider.value);
    var real = s.rating;

    // блокируем бегунок и кнопку
    slider.disabled = true;
    $('btn-guess').disabled = true;
    $('btn-guess').hidden = true;

    var diffSigned = (tenths(user) - tenths(real)) / 10; // >0 переоценил, <0 недооценил
    var diffAbs = Math.abs(diffSigned);
    var points = pointsFor(user, real);

    results.push({ user: user, real: real, diffSigned: diffSigned, diffAbs: diffAbs, points: points });
    renderProgress();

    // --- эмоциональное сообщение ---
    var msg;
    if (diffAbs === 0) msg = 'Идеально! 🎯';
    else if (diffAbs <= 0.2) msg = 'Почти идеально! 🎯';
    else if (diffAbs <= 0.5) msg = 'Очень близко!';
    else msg = 'Киноинтуиция сегодня подводит 😅';
    $('msg-emotion').textContent = msg;

    $('real-rating').textContent = fmt1(real);
    $('user-rating').textContent = fmt1(user);

    var diffEl = $('diff-value');
    diffEl.textContent = fmtSigned(diffSigned);
    diffEl.className = 'rr-value diff ' + (diffAbs <= 0.3 ? 'good' : 'bad');

    // --- баллы с анимацией увеличения ---
    var pointsEl = $('points-value');
    animateCount(pointsEl, 0, points, 700);

    // --- вердикт словами ---
    var verb, verbNoun;
    if (diffSigned < 0) { verb = 'недооценил'; verbNoun = 'ниже'; }
    else if (diffSigned > 0) { verb = 'переоценил'; verbNoun = 'выше'; }
    else { verb = 'угадал точно'; verbNoun = ''; }

    var verdictHtml;
    if (diffSigned === 0) {
      verdictHtml = 'Ты поставил <b>' + fmt1(user) + '</b> — ровно как на Кинопоиске!';
    } else {
      verdictHtml =
        'Ты поставил <b>' + fmt1(user) + '</b>, а реальный рейтинг — <b>' + fmt1(real) + '</b>.<br>' +
        'Ты ' + verb + ' сериал на <b>' + fmt1(diffAbs) + '</b>';
    }
    $('verdict').innerHTML = verdictHtml;

    var total = results.reduce(function (sum, r) { return sum + r.points; }, 0);
    $('total-so-far').textContent = fmtNum(total);

    $('btn-next').textContent = (round + 1 >= ROUNDS) ? 'К ИТОГАМ →' : 'СЛЕДУЮЩИЙ СЕРИАЛ →';
    $('result').hidden = false;
    $('result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  function animateCount(el, from, to, dur, sign) {
    var t0 = null;
    el.textContent = (sign || '') + fmtNum(from);
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (sign || '') + fmtNum(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ---------- Следующий раунд / итоги ----------
  $('btn-next').addEventListener('click', function () {
    if (!results.length) return;
    round++;
    if (round >= ROUNDS) renderFinal();
    else renderRound();
  });

  // ---------- Старт ----------
  $('btn-start').addEventListener('click', startGame);
  $('btn-again').addEventListener('click', startGame);

  function startGame() {
    deck = shuffle(window.SERIES.slice()).slice(0, ROUNDS);
    round = 0;
    results = [];
    renderRound();
    showScreen('game');
  }

  function plural(n) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return 'сериал';
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'сериала';
    return 'сериалов';
  }

  // ---------- Итоговый экран ----------
  function renderFinal() {
    var total = results.reduce(function (s, r) { return s + r.points; }, 0);
    var avgErr = results.reduce(function (s, r) { return s + r.diffAbs; }, 0) / results.length;
    var over = results.filter(function (r) { return r.diffSigned > 0; }).length;
    var under = results.filter(function (r) { return r.diffSigned < 0; }).length;
    var nearPerfect = results.filter(function (r) { return r.diffAbs <= 0.2; }).length;
    var best = Math.min.apply(null, results.map(function (r) { return r.diffAbs; }));
    var worst = Math.max.apply(null, results.map(function (r) { return r.diffAbs; }));
    var percent = Math.round(total / (ROUNDS * MAX_POINTS) * 100);

    // главный счёт с анимацией
    animateCount($('final-points'), 0, total, 1100, '');
    $('final-percent').textContent = percent + '%';
    setTimeout(function () {
      $('final-percent-fill').style.width = percent + '%';
    }, 150);

    // тип игрока
    var typeName, typeDesc, typeStat;
    if (avgErr <= 0.3) {
      typeName = 'Кинокритик 🎬';
      typeDesc = 'Ты удивительно хорошо чувствуешь рейтинги Кинопоиска.';
      typeStat = 'Почти идеальных ответов: ' + nearPerfect + ' из ' + ROUNDS;
    } else if (over > under) {
      typeName = 'Оптимист 🍿';
      typeDesc = 'Ты регулярно думаешь, что сериалы лучше, чем считает Кинопоиск.';
      typeStat = 'Ты переоценил ' + over + ' из ' + ROUNDS + ' сериалов.';
    } else if (under > over) {
      typeName = 'Скептик 🧐';
      typeDesc = 'Ты оцениваешь сериалы строже, чем Кинопоиск.';
      typeStat = 'Ты недооценил ' + under + ' из ' + ROUNDS + ' сериалов.';
    } else {
      typeName = 'Балансируешь 🎭';
      typeDesc = 'Ты одинаково часто и переоцениваешь, и недооцениваешь сериалы.';
      typeStat = 'Переоценил ' + over + ' · недооценил ' + under;
    }
    $('type-name').textContent = typeName;
    $('type-desc').textContent = typeDesc;
    $('type-stat').textContent = typeStat;

    $('st-avg').textContent = fmt1(avgErr);
    $('st-over').textContent = over + ' ' + plural(over);
    $('st-under').textContent = under + ' ' + plural(under);
    $('st-best').textContent = 'ошибка ' + fmt1(best);
    $('st-worst').textContent = 'ошибка ' + fmt1(worst);

    // визуализация по раундам
    var chart = $('rounds-chart');
    chart.innerHTML = '';
    results.forEach(function (r, i) {
      var row = document.createElement('div');
      row.className = 'round-row';
      row.innerHTML =
        '<span class="round-name">Раунд ' + (i + 1) + '</span>' +
        '<span class="round-track"><span class="round-fill"></span></span>' +
        '<span class="round-pts">' + fmtNum(r.points) + '</span>';
      chart.appendChild(row);
    });
    // заполняем полоски по очереди
    setTimeout(function () {
      var fills = chart.querySelectorAll('.round-fill');
      for (var i = 0; i < fills.length; i++) {
        (function (idx) {
          setTimeout(function () {
            fills[idx].style.width = (results[idx].points / MAX_POINTS * 100) + '%';
          }, idx * 90);
        })(i);
      }
    }, 200);

    showScreen('final');
  }

})();
