/**
 * SiteTracker — universal analytics + feedback widget
 * Usage: <script src="http://31.97.56.148:3098/t.js" data-site="invoicemint.cloud" defer></script>
 */
(function () {
  "use strict";

  var API = "http://31.97.56.148:3098";
  var script = document.currentScript || (function () {
    var s = document.querySelectorAll('script[data-site]');
    return s[s.length - 1];
  })();
  var SITE = (script && script.getAttribute("data-site")) || location.hostname;

  // ── Session ID ──────────────────────────────────────────────
  var SID_KEY = "st_sid_" + SITE;
  function sid() {
    var s = sessionStorage.getItem(SID_KEY);
    if (!s) {
      s = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(SID_KEY, s);
    }
    return s;
  }

  // ── Page counter ────────────────────────────────────────────
  var PAGE_KEY = "st_pages_" + SITE;
  function incPages() {
    var n = parseInt(sessionStorage.getItem(PAGE_KEY) || "0", 10) + 1;
    sessionStorage.setItem(PAGE_KEY, String(n));
    return n;
  }

  // ── Send helpers ────────────────────────────────────────────
  function send(endpoint, body) {
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(API + endpoint, JSON.stringify(body));
      } else {
        fetch(API + endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          keepalive: true,
        }).catch(function () {});
      }
    } catch (e) {}
  }

  // ── Track pageview ──────────────────────────────────────────
  function trackPage() {
    send("/track", {
      site: SITE,
      path: location.pathname + location.search,
      referrer: document.referrer || null,
      session_id: sid(),
    });
    incPages();
  }

  // ── Track event ─────────────────────────────────────────────
  window.stEvent = function (name, value) {
    send("/track", {
      site: SITE,
      path: location.pathname,
      session_id: sid(),
      event: name,
      value: value != null ? String(value) : undefined,
    });
  };

  // ── Session end ─────────────────────────────────────────────
  var startTime = Date.now();
  function flushSession() {
    var dur = Math.round((Date.now() - startTime) / 1000);
    if (dur < 2) return;
    send("/session", {
      site: SITE,
      session_id: sid(),
      duration_s: dur,
      pages: parseInt(sessionStorage.getItem(PAGE_KEY) || "1", 10),
    });
  }
  window.addEventListener("pagehide", flushSession);
  window.addEventListener("beforeunload", flushSession);

  // ── SPA navigation support ───────────────────────────────────
  var lastPath = location.pathname;
  if (history.pushState) {
    var orig = history.pushState.bind(history);
    history.pushState = function () {
      orig.apply(history, arguments);
      if (location.pathname !== lastPath) { lastPath = location.pathname; trackPage(); }
    };
    window.addEventListener("popstate", function () {
      if (location.pathname !== lastPath) { lastPath = location.pathname; trackPage(); }
    });
  }

  // ── Feedback widget ─────────────────────────────────────────
  function buildWidget() {
    // Styles
    var style = document.createElement("style");
    style.textContent = [
      "#st-btn{position:fixed;bottom:20px;right:20px;z-index:9999;background:#10b981;color:#fff;border:none;",
      "border-radius:50px;padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer;",
      "box-shadow:0 4px 14px rgba(16,185,129,.4);display:flex;align-items:center;gap:6px;",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;transition:transform .15s,background .15s;}",
      "#st-btn:hover{background:#059669;transform:scale(1.04);}",
      "#st-modal{display:none;position:fixed;bottom:72px;right:20px;z-index:9999;width:320px;",
      "background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.18);",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden;}",
      "#st-modal.open{display:block;}",
      "#st-head{background:linear-gradient(135deg,#10b981,#0d9488);padding:14px 16px;color:#fff;}",
      "#st-head h3{margin:0;font-size:14px;font-weight:700;}",
      "#st-head p{margin:3px 0 0;font-size:11px;opacity:.85;}",
      "#st-body{padding:14px 16px 16px;}",
      ".st-stars{display:flex;gap:4px;margin-bottom:12px;}",
      ".st-star{font-size:22px;cursor:pointer;color:#d1d5db;transition:color .1s;line-height:1;}",
      ".st-star.on{color:#f59e0b;}",
      ".st-cats{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;}",
      ".st-cat{padding:4px 10px;border-radius:20px;border:1.5px solid #e2e8f0;font-size:11px;",
      "cursor:pointer;color:#64748b;font-weight:500;transition:all .1s;}",
      ".st-cat.on{border-color:#10b981;background:#ecfdf5;color:#065f46;}",
      "#st-msg{width:100%;box-sizing:border-box;border:1.5px solid #e2e8f0;border-radius:10px;",
      "padding:8px 10px;font-size:12px;resize:none;outline:none;color:#1e293b;",
      "font-family:inherit;transition:border-color .15s;}",
      "#st-msg:focus{border-color:#10b981;}",
      "#st-email{width:100%;box-sizing:border-box;border:1.5px solid #e2e8f0;border-radius:10px;",
      "padding:7px 10px;font-size:12px;outline:none;color:#1e293b;margin-top:8px;",
      "font-family:inherit;transition:border-color .15s;}",
      "#st-email:focus{border-color:#10b981;}",
      "#st-submit{margin-top:10px;width:100%;background:#10b981;color:#fff;border:none;",
      "border-radius:10px;padding:9px;font-size:13px;font-weight:600;cursor:pointer;",
      "transition:background .15s;}",
      "#st-submit:hover{background:#059669;}",
      "#st-submit:disabled{opacity:.5;cursor:default;}",
      "#st-thanks{display:none;text-align:center;padding:20px;color:#065f46;font-size:13px;font-weight:600;}",
      "#st-close{position:absolute;top:10px;right:12px;background:none;border:none;",
      "color:#fff;font-size:18px;cursor:pointer;line-height:1;padding:2px 6px;}",
    ].join("");
    document.head.appendChild(style);

    // Button
    var btn = document.createElement("button");
    btn.id = "st-btn";
    btn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 16V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2h11l4 4v-4z"/></svg>Feedback';
    document.body.appendChild(btn);

    // Modal
    var modal = document.createElement("div");
    modal.id = "st-modal";
    modal.innerHTML = [
      '<div id="st-head" style="position:relative">',
      '  <button id="st-close" aria-label="Close">&times;</button>',
      '  <h3>Share your feedback</h3>',
      '  <p>Takes 30 seconds — helps us improve</p>',
      '</div>',
      '<div id="st-body">',
      '  <div class="st-stars">',
      '    <span class="st-star" data-v="1">&#9733;</span>',
      '    <span class="st-star" data-v="2">&#9733;</span>',
      '    <span class="st-star" data-v="3">&#9733;</span>',
      '    <span class="st-star" data-v="4">&#9733;</span>',
      '    <span class="st-star" data-v="5">&#9733;</span>',
      '  </div>',
      '  <div class="st-cats">',
      '    <span class="st-cat" data-c="bug">Bug</span>',
      '    <span class="st-cat" data-c="feature">Feature request</span>',
      '    <span class="st-cat" data-c="ux">UX / Design</span>',
      '    <span class="st-cat" data-c="content">Content</span>',
      '    <span class="st-cat" data-c="other">Other</span>',
      '  </div>',
      '  <textarea id="st-msg" rows="3" placeholder="What\'s on your mind? (required)"></textarea>',
      '  <input id="st-email" type="email" placeholder="Email (optional — for follow-up)" />',
      '  <button id="st-submit">Send feedback</button>',
      '  <div id="st-thanks">Thank you! Your feedback was sent.</div>',
      '</div>',
    ].join("");
    document.body.appendChild(modal);

    var rating = 0;
    var category = null;

    btn.addEventListener("click", function () {
      modal.classList.toggle("open");
    });
    document.getElementById("st-close").addEventListener("click", function () {
      modal.classList.remove("open");
    });

    modal.querySelectorAll(".st-star").forEach(function (s) {
      s.addEventListener("click", function () {
        rating = parseInt(s.getAttribute("data-v"), 10);
        modal.querySelectorAll(".st-star").forEach(function (x) {
          x.classList.toggle("on", parseInt(x.getAttribute("data-v"), 10) <= rating);
        });
      });
    });

    modal.querySelectorAll(".st-cat").forEach(function (c) {
      c.addEventListener("click", function () {
        modal.querySelectorAll(".st-cat").forEach(function (x) { x.classList.remove("on"); });
        c.classList.add("on");
        category = c.getAttribute("data-c");
      });
    });

    document.getElementById("st-submit").addEventListener("click", function () {
      var msg = document.getElementById("st-msg").value.trim();
      if (!msg) { document.getElementById("st-msg").focus(); return; }
      var submitBtn = document.getElementById("st-submit");
      submitBtn.disabled = true;

      fetch(API + "/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site: SITE,
          session_id: sid(),
          rating: rating || null,
          category: category,
          message: msg,
          email: document.getElementById("st-email").value.trim() || null,
          path: location.pathname,
        }),
      })
        .then(function () {
          document.getElementById("st-body").style.display = "none";
          document.getElementById("st-thanks").style.display = "block";
          setTimeout(function () { modal.classList.remove("open"); }, 2000);
        })
        .catch(function () { submitBtn.disabled = false; });
    });

    // Auto-prompt: show widget after 90s if user hasn't given feedback this session
    var FB_KEY = "st_fb_" + SITE;
    if (!sessionStorage.getItem(FB_KEY)) {
      setTimeout(function () {
        if (!modal.classList.contains("open")) {
          modal.classList.add("open");
          sessionStorage.setItem(FB_KEY, "1");
        }
      }, 90000);
    }
  }

  // ── Auto click tracking for [data-track] elements ──────────
  function bindClickTracking() {
    document.querySelectorAll("[data-track]").forEach(function (el) {
      if (el._stBound) return;
      el._stBound = true;
      el.addEventListener("click", function () {
        var name = el.getAttribute("data-track");
        var val  = el.getAttribute("data-track-value") || el.href || el.textContent.trim().slice(0, 60);
        window.stEvent(name, val);
      });
    });
  }

  // Re-bind on DOM mutations (React/Next.js hydration)
  if (typeof MutationObserver !== "undefined") {
    var mo = new MutationObserver(bindClickTracking);
    mo.observe(document.body, { childList: true, subtree: true });
  }

  // ── Init ────────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      trackPage();
      buildWidget();
      bindClickTracking();
    });
  } else {
    trackPage();
    buildWidget();
    bindClickTracking();
  }
})();
