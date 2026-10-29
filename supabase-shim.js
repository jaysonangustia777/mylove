/* Family Circle: Supabase adapter.
   Gives the app the same small database/user API it uses inside Claude (window.claude.use("db"|"user"|"downloads")),
   but stores everything in your Supabase project (table public.fc_docs, see supabase-schema.sql). */
(function () {
  var SB_URL = "https://fbprlvsjeqnuxjxlkqps.supabase.co";
  var SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZicHJsdnNqZXFudXhqeGxrcXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5OTgxMzAsImV4cCI6MjEwODU3NDEzMH0.lQ8EvUL6m1HG-33l5gevuscKk4f1GGKsxb2JUbvUelQ";
  if (!window.supabase) return;
  var sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, detectSessionInUrl: true } });
  var box = null, skipped = false, waiters = [];
  var LOG = [], panel = null, tick = null;
  function L(m) { LOG.push(new Date().toLocaleTimeString() + "  " + m); if (LOG.length > 200) LOG.shift(); }
  window.addEventListener("error", function (e) { L("JS error: " + e.message); });
  window.addEventListener("unhandledrejection", function (e) { L("Promise error: " + ((e.reason && e.reason.message) || e.reason)); });
  function paint() {
    var s = {}; try { s = JSON.parse(localStorage.getItem("family-circle-v1") || "{}"); } catch (e) {}
    sb.auth.getSession().then(function (r) {
      var u = r.data.session && r.data.session.user;
      panel.querySelector("#fcStat").textContent = "Signed in: " + (u ? u.email : "no") + "\nGroup: " + (s.gid ? (s.gname || "") + " (" + s.gid + ")" : "none yet") + "\nPage: hosted copy with Supabase";
      panel.querySelector("#fcLog").textContent = LOG.slice().reverse().join("\n") || "Nothing yet.";
    });
  }
  function debugUi() {
    var b = document.createElement("button");
    b.textContent = "\ud83d\udc1e Status";
    b.style.cssText = "position:fixed;left:12px;bottom:96px;z-index:150;padding:8px 12px;border:0;border-radius:99px;background:#1d2340;color:#fff;font:600 13px system-ui,sans-serif;opacity:.85";
    panel = document.createElement("div");
    panel.style.cssText = "display:none;position:fixed;left:8px;right:8px;bottom:146px;max-height:55vh;z-index:150;background:#10152b;color:#d9e1ff;border-radius:16px;padding:12px;font:12px/1.5 ui-monospace,Menlo,monospace;overflow:auto;box-shadow:0 10px 30px rgba(0,0,0,.4)";
    panel.innerHTML = '<div style="display:flex;gap:8px;margin-bottom:8px"><button id="fcCopy" style="padding:6px 10px;border:0;border-radius:8px">Copy log</button><button id="fcClose" style="padding:6px 10px;border:0;border-radius:8px">Close</button></div><pre id="fcStat" style="white-space:pre-wrap;margin:0 0 8px;color:#9ff0c0"></pre><pre id="fcLog" style="white-space:pre-wrap;margin:0"></pre>';
    document.body.appendChild(b); document.body.appendChild(panel);
    b.onclick = function () {
      var open = panel.style.display === "none"; panel.style.display = open ? "block" : "none";
      clearInterval(tick); if (open) { paint(); tick = setInterval(paint, 1000); }
    };
    panel.querySelector("#fcClose").onclick = function () { panel.style.display = "none"; clearInterval(tick); };
    panel.querySelector("#fcCopy").onclick = function () {
      var t = panel.querySelector("#fcStat").textContent + "\n\n" + LOG.join("\n");
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { L("log copied"); });
    };
  }
  if (document.body) debugUi(); else document.addEventListener("DOMContentLoaded", debugUi);

  function showLogin() {
    if (box || skipped) return;
    box = document.createElement("div");
    box.style.cssText = "position:fixed;inset:0;z-index:200;background:rgba(20,20,40,.7);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif";
    box.innerHTML = '<div style="background:#fff;color:#1d2340;border-radius:20px;padding:22px;width:min(340px,100%);text-align:center">' +
      '<div style="font-size:1.3rem;font-weight:800;margin-bottom:6px">Sign in to Family Circle</div>' +
      '<div style="font-size:.9rem;color:#6b7396;margin-bottom:12px">Enter your email. We send you a link to sign in. No password needed.</div>' +
      '<input id="fcEmail" type="email" placeholder="you@email.com" autocomplete="email" style="width:100%;padding:12px;border:1px solid #cfd6f5;border-radius:12px;font-size:16px;margin-bottom:10px">' +
      '<button id="fcSend" style="width:100%;padding:12px;border:0;border-radius:12px;background:#5b5bd6;color:#fff;font-size:16px;font-weight:700">Send sign-in link</button>' +
      '<div id="fcMsg" style="min-height:1.4em;margin:10px 0;font-size:.9rem"></div>' +
      '<a href="#" id="fcSkip" style="font-size:.85rem;color:#6b7396">Continue without signing in</a></div>';
    document.body.appendChild(box);
    document.getElementById("fcSend").onclick = function () {
      var em = document.getElementById("fcEmail").value.trim(), m = document.getElementById("fcMsg");
      if (!em) { m.textContent = "Type your email first."; return; }
      m.textContent = "Sending…";
      sb.auth.signInWithOtp({ email: em, options: { emailRedirectTo: location.origin + location.pathname } }).then(function (r) {
        m.textContent = r.error ? "Couldn’t send: " + r.error.message : "Check your email and open the link on this device.";
      });
    };
    document.getElementById("fcSkip").onclick = function (e) { e.preventDefault(); skipped = true; hide(); };
  }
  function hide() { if (box) { box.remove(); box = null; } }

  function session() {
    return sb.auth.getSession().then(function (r) {
      if (r.data.session) return r.data.session;
      return new Promise(function (res) {
        waiters.push(res);
        if (document.body) showLogin(); else document.addEventListener("DOMContentLoaded", showLogin);
      });
    });
  }
  sb.auth.onAuthStateChange(function (ev, s) {
    L("auth: " + ev + " " + (s && s.user ? s.user.email : "no session"));
    if (s) { hide(); var w = waiters; waiters = []; w.forEach(function (f) { f(s); }); }
  });

  function wrap(p) { return p.then(function (x) { if (x.error) throw x.error; return x; }); }
  var db = {
    collection: function (c) {
      var q = { o: null, l: 200 };
      var o = {
        doc: function (id) {
          if (!id) { id = ""; var cs = "abcdefghijklmnopqrstuvwxyz0123456789"; for (var i = 0; i < 20; i++) id += cs[Math.floor(Math.random() * cs.length)]; }
          return db.doc(c + "/" + id);
        },
        orderBy: function (f, d) { q.o = [f, d]; return o; },
        limit: function (n) { q.l = n; return o; },
        onSnapshot: function (cb, eb) {
          var alive = true;
          function load() {
            var r = sb.from("fc_docs").select("doc_id,data").eq("collection", c);
            if (q.o && q.o[0] === "t") r = r.order("t", { ascending: q.o[1] === "asc", nullsFirst: false });
            r.limit(q.l).then(function (x) {
              if (!alive) return;
              if (x.error) { L("load " + c + " ERROR: " + x.error.message); if (eb) eb(x.error); return; }
              L("loaded " + c + ": " + x.data.length + " item(s)");
              cb({ docs: x.data.map(function (d) { return { id: d.doc_id, data: function () { return d.data; } }; }) });
            });
          }
          load();
          var ch = sb.channel("fc-" + c + "-" + Math.random().toString(36).slice(2))
            .on("postgres_changes", { event: "*", schema: "public", table: "fc_docs", filter: "collection=eq." + c }, load)
            .subscribe(function (st) { L("live " + c + ": " + st); });
          return function () { alive = false; sb.removeChannel(ch); };
        }
      };
      return o;
    },
    doc: function (p) {
      var i = p.indexOf("/"), c = p.slice(0, i), id = p.slice(i + 1);
      function ensureMember() {
        if (c !== "chat") return Promise.resolve();
        return sb.auth.getSession().then(function (r) {
          var u = r.data.session && r.data.session.user, st = {};
          if (!u) return;
          try { st = JSON.parse(localStorage.getItem("family-circle-v1") || "{}"); } catch (e) {}
          if (!st.gid) return;
          return sb.from("fc_docs").upsert(
            { collection: "members", doc_id: u.id, data: { g: st.gid, name: st.me || "Family", status: st.meStatus || "Safe", t: Date.now() } },
            { onConflict: "collection,doc_id", ignoreDuplicates: true }
          ).then(function (x) { if (x.error) L("member card ERROR: " + x.error.message); });
        });
      }
      function put(d) {
        return ensureMember().then(function () {
          return wrap(sb.from("fc_docs").upsert({ collection: c, doc_id: id, data: d }, { onConflict: "collection,doc_id" }));
        });
      }
      return {
        set: put,
        update: function (d) {
          return sb.from("fc_docs").select("data").eq("collection", c).eq("doc_id", id).maybeSingle().then(function (x) {
            return put(Object.assign({}, (x.data && x.data.data) || {}, d));
          });
        },
        delete: function () { return wrap(sb.from("fc_docs").delete().eq("collection", c).eq("doc_id", id)); }
      };
    }
  };
  var _doc = db.doc;
  db.doc = function (p) {
    var d = _doc(p);
    ["set", "update", "delete"].forEach(function (m) {
      var f = d[m];
      d[m] = function () {
        return f.apply(d, arguments).then(function (r) { L(m + " " + p + " ok"); return r; },
          function (e) { L(m + " " + p + " ERROR: " + ((e && e.message) || e)); throw e; });
      };
    });
    return d;
  };
  var user = {
    id: function () { return sb.auth.getSession().then(function (r) { return r.data.session ? r.data.session.user.id : null; }); },
    me: function () {
      return sb.auth.getSession().then(function (r) {
        var u = r.data.session && r.data.session.user;
        return u ? { name: (u.user_metadata && u.user_metadata.name) || (u.email || "").split("@")[0] } : null;
      });
    }
  };
  var downloads = {
    save: function (req) {
      var blob = req.data instanceof Blob ? req.data : new Blob([req.data]);
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = req.filename || "file";
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      return Promise.resolve({ ok: true });
    }
  };
  window.claude = {
    use: function (name) {
      if (name === "downloads") return Promise.resolve(downloads);
      if (name === "db") return session().then(function () {
        return sb.rpc("fc_auto_group").then(function (r) { window.FC_AUTOJOIN = (r && r.data) || null; return db; }, function () { return db; });
      });
      if (name === "user") return session().then(function () { return user; });
      return Promise.resolve(null);
    }
  };
})();
