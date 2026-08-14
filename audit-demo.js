/* Agent Kai - in-browser CRM audit.
 *
 * A faithful port of gtmos/audit/engine.py. Same weights, same thresholds,
 * same unreachability cap, same dupe rules - so the number this prints is
 * the number the real engine prints, not a marketing approximation.
 *
 * Everything runs on this page. There is no fetch() in this file and no
 * endpoint behind it: pasted data never leaves the browser, which is the
 * product claim demonstrated rather than asserted. Keep it that way.
 */
(function () {
  "use strict";

  // ---- constants, mirrored from engine.py ----------------------------------
  var JUNK = new Set(["test", "asdf", "n/a", "na", "unknown", "none", "-", "null", "n.a.", "xx", "xxx", ""]);
  var DISPOSABLE = ["mailinator", "tempmail", "temp-mail", "guerrillamail", "yopmail", "trashmail",
    "10minutemail", "throwaway", "fakeinbox", "getnada", "discard.email", "sharklasers"];
  var EMAIL_RE = /^[A-Za-z0-9_.+-]+@[A-Za-z0-9-]+\.[A-Za-z0-9.-]+$/;
  var ADVANCED_STAGES = new Set(["customer", "opportunity"]);
  var UNREACHABLE_CAP = 45.0;
  var COMPLETENESS_WEIGHTS = { email: 30, company: 20, jobtitle: 15, lastname: 10, phone: 10, owner: 15 };
  var DIM_WEIGHTS = { completeness: 0.30, validity: 0.25, freshness: 0.25, ownership: 0.10, consistency: 0.10 };
  var GRADE_BANDS = [[85, "A"], [70, "B"], [55, "C"], [40, "D"], [0, "F"]];

  function isJunk(v) {
    if (v === null || v === undefined) return true;
    return JUNK.has(String(v).trim().toLowerCase());
  }
  function present(c, k) { return !isJunk(c[k]); }

  function validEmail(email) {
    if (!EMAIL_RE.test(email)) return false;
    var at = email.lastIndexOf("@");
    var local = email.slice(0, at).toLowerCase();
    var domain = email.slice(at + 1).toLowerCase();
    if (domain.indexOf(".") === -1) return false;
    var head = domain.split(".")[0];
    if (JUNK.has(local)) return false;
    if (JUNK.has(head) || ["example", "test", "email", "domain"].indexOf(head) !== -1) return false;
    for (var i = 0; i < DISPOSABLE.length; i++) if (domain.indexOf(DISPOSABLE[i]) !== -1) return false;
    return true;
  }
  function validPhone(phone) {
    var digits = String(phone).replace(/\D/g, "");
    return digits.length >= 7 && digits.length <= 15;
  }

  function scoreCompleteness(c) {
    var total = 0;
    for (var f in COMPLETENESS_WEIGHTS) if (present(c, f)) total += COMPLETENESS_WEIGHTS[f];
    return total;
  }

  function scoreValidity(c) {
    var sum = 0, wt = 0;
    if (!isJunk(c.email)) { sum += 50 * (validEmail(String(c.email).trim()) ? 100 : 0); wt += 50; }
    if (!isJunk(c.phone)) { sum += 25 * (validPhone(c.phone) ? 100 : 0); wt += 25; }
    var fields = ["firstname", "lastname", "company", "jobtitle", "lifecyclestage", "owner"];
    var populated = fields.filter(function (f) {
      return c[f] !== null && c[f] !== undefined && String(c[f]).trim() !== "";
    });
    if (populated.length) {
      var junkCount = populated.filter(function (f) { return isJunk(c[f]); }).length;
      sum += 25 * (100 * (1 - junkCount / populated.length));
      wt += 25;
    }
    return wt === 0 ? 0 : sum / wt;
  }

  function daysSince(raw) {
    if (!raw) return null;
    var d = new Date(String(raw).replace("Z", "+00:00"));
    if (isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  }

  function scoreFreshness(c) {
    var days = daysSince(c.last_activity_date);
    if (days === null) return 0;
    if (days <= 30) return 100;
    if (days <= 90) return 80;
    if (days <= 180) return 55;
    if (days <= 365) return 30;
    return 10;
  }

  function scoreOwnership(c) { return present(c, "owner") ? 100 : 0; }

  function scoreConsistency(c) {
    if (isJunk(c.lifecyclestage)) return 0;
    var stage = String(c.lifecyclestage).trim().toLowerCase();
    if (ADVANCED_STAGES.has(stage)) {
      var days = daysSince(c.last_activity_date);
      if (days === null) return 20;
      if (days > 365) return 20;
    }
    return 100;
  }

  function scoreRecord(c, i) {
    var dims = {
      completeness: scoreCompleteness(c), validity: scoreValidity(c), freshness: scoreFreshness(c),
      ownership: scoreOwnership(c), consistency: scoreConsistency(c)
    };
    var overall = 0;
    for (var d in DIM_WEIGHTS) overall += dims[d] * DIM_WEIGHTS[d];
    var reachable = (!isJunk(c.email) && validEmail(String(c.email).trim())) ||
                    (!isJunk(c.phone) && validPhone(c.phone));
    if (!reachable) overall = Math.min(overall, UNREACHABLE_CAP);
    var worst = Object.keys(dims).reduce(function (a, b) { return dims[a] <= dims[b] ? a : b; });
    return { index: i, email: c.email, dims: dims, overall: overall, worst: worst, reachable: reachable };
  }

  function normalizeCompany(s) {
    var n = String(s).trim().toLowerCase();
    [" inc", " inc.", " llc", " llc.", " ltd", " ltd.", " corp", " corp.", " co", " co."].forEach(function (suf) {
      if (n.endsWith(suf)) n = n.slice(0, -suf.length);
    });
    return n.trim();
  }

  function findDupes(contacts) {
    var clusters = [], byEmail = {}, byName = {};
    contacts.forEach(function (c, i) {
      if (!isJunk(c.email)) {
        var k = String(c.email).trim().toLowerCase();
        (byEmail[k] = byEmail[k] || []).push(i);
      }
      if (!isJunk(c.lastname) && !isJunk(c.company)) {
        var k2 = String(c.lastname).trim().toLowerCase() + "|" + normalizeCompany(c.company);
        (byName[k2] = byName[k2] || []).push(i);
      }
    });
    Object.keys(byEmail).forEach(function (k) {
      if (byEmail[k].length > 1) clusters.push({ kind: "exact_email", key: k, indices: byEmail[k] });
    });
    Object.keys(byName).forEach(function (k) {
      if (byName[k].length > 1) clusters.push({ kind: "fuzzy_name_company", key: k, indices: byName[k] });
    });
    return clusters;
  }

  function gradeFor(score) {
    for (var i = 0; i < GRADE_BANDS.length; i++) if (score >= GRADE_BANDS[i][0]) return GRADE_BANDS[i][1];
    return "F";
  }

  function runEngine(contacts) {
    var records = contacts.map(scoreRecord);
    var total = records.length;
    if (!total) return null;
    var mean = records.reduce(function (s, r) { return s + r.overall; }, 0) / total;
    var dims = {};
    Object.keys(DIM_WEIGHTS).forEach(function (d) {
      dims[d] = records.reduce(function (s, r) { return s + r.dims[d]; }, 0) / total;
    });
    var clusters = findDupes(contacts);
    var duped = new Set();
    clusters.forEach(function (c) { c.indices.forEach(function (i) { duped.add(i); }); });
    var penalty = Math.min(10, (duped.size / total) * 25);
    return {
      records: records, total: total, portal: Math.max(0, mean - penalty),
      dims: dims, clusters: clusters, dupedCount: duped.size, penalty: penalty,
      dead: records.filter(function (r) { return !r.reachable; }).length
    };
  }

  // ---- parsing -------------------------------------------------------------
  var FIELD_ALIASES = {
    email: "email", "e-mail": "email", firstname: "firstname", "first name": "firstname",
    "first_name": "firstname", lastname: "lastname", "last name": "lastname", "last_name": "lastname",
    company: "company", "company name": "company", jobtitle: "jobtitle", "job title": "jobtitle",
    title: "jobtitle", phone: "phone", "phone number": "phone", lifecyclestage: "lifecyclestage",
    "lifecycle stage": "lifecyclestage", stage: "lifecyclestage", owner: "owner",
    "contact owner": "owner", "last_activity_date": "last_activity_date",
    "last activity date": "last_activity_date", "last activity": "last_activity_date"
  };

  function normalizeContact(raw) {
    var out = {};
    var src = raw.properties && typeof raw.properties === "object" ? raw.properties : raw;
    Object.keys(src).forEach(function (k) {
      var canon = FIELD_ALIASES[k.trim().toLowerCase()];
      if (canon && (out[canon] === undefined || out[canon] === null || out[canon] === "")) out[canon] = src[k];
    });
    return out;
  }

  function parseCSV(text) {
    var lines = text.trim().split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (lines.length < 2) return [];
    function splitRow(line) {
      var cells = [], cur = "", q = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
        else if (ch === "," && !q) { cells.push(cur); cur = ""; }
        else cur += ch;
      }
      cells.push(cur);
      return cells.map(function (c) { return c.trim(); });
    }
    var headers = splitRow(lines[0]);
    return lines.slice(1).map(function (line) {
      var cells = splitRow(line), row = {};
      headers.forEach(function (h, i) { row[h] = cells[i] === undefined ? "" : cells[i]; });
      return row;
    });
  }

  function parseInput(text) {
    var trimmed = text.trim();
    if (!trimmed) throw new Error("Paste some records first, or load the sample.");
    var rows;
    if (trimmed[0] === "[" || trimmed[0] === "{") {
      var data = JSON.parse(trimmed);
      rows = Array.isArray(data) ? data : (Array.isArray(data.results) ? data.results : [data]);
    } else {
      rows = parseCSV(trimmed);
    }
    if (!rows.length) throw new Error("No rows found. CSV needs a header row, JSON needs an array.");
    return rows.map(normalizeContact);
  }

  // ---- sample --------------------------------------------------------------
  function sampleCSV() {
    var recent = new Date(Date.now() - 12 * 86400000).toISOString().slice(0, 10);
    var old = new Date(Date.now() - 500 * 86400000).toISOString().slice(0, 10);
    var mid = new Date(Date.now() - 200 * 86400000).toISOString().slice(0, 10);
    return [
      "email,firstname,lastname,company,jobtitle,phone,lifecyclestage,owner,last_activity_date",
      "dana@northwind.io,Dana,Reyes,Northwind Inc,VP Sales,+1 415 555 0142,opportunity,sam@you.co," + recent,
      "dana@northwind.io,Dana,Reyes,Northwind,VP Sales,,opportunity,sam@you.co," + recent,
      "ops@cedarstone.dev,Priya,Nair,Cedar Stone LLC,RevOps Lead,+1 212 555 0199,customer,sam@you.co," + mid,
      "test@test.com,test,test,test,,,,,",
      "no-reply@mailinator.com,Alex,Kim,Halcyon Systems,Director,,,lead,," + old,
      ",Jordan,Blake,Meridian Labs,Head of Growth,555,lead,,",
      "sam@brightpath.co,Sam,Ortiz,Brightpath Co,Founder,+44 20 7946 0958,customer,ana@you.co," + old,
      "lee@quanta.io,Lee,Chen,Quanta Freight,Ops Manager,+1 303 555 0110,lead,ana@you.co," + recent
    ].join("\n");
  }

  // ---- render --------------------------------------------------------------
  function el(id) { return document.getElementById(id); }
  function pct(n) { return n.toFixed(1); }

  function renderResults(res) {
    var grade = gradeFor(res.portal);
    var dimRows = Object.keys(res.dims).sort(function (a, b) { return res.dims[a] - res.dims[b]; })
      .map(function (d) {
        var v = res.dims[d];
        return '<div class="ad-dim"><span class="ad-dim-name">' + d + '</span>' +
          '<span class="ad-bar"><i style="width:' + Math.max(2, v) + '%"></i></span>' +
          '<span class="ad-dim-val mono">' + pct(v) + '</span></div>';
      }).join("");

    var worst = res.records.slice().sort(function (a, b) { return a.overall - b.overall; }).slice(0, 5)
      .map(function (r) {
        return '<tr><td class="mono">' + (r.email ? String(r.email).replace(/[<>&]/g, "") : "<em>no email</em>") +
          '</td><td class="mono">' + pct(r.overall) + '</td><td>' + r.worst + '</td></tr>';
      }).join("");

    el("ad-results").innerHTML =
      '<div class="ad-headline">' +
        '<div class="ad-score"><span class="ad-score-val mono">' + pct(res.portal) + '</span>' +
        '<span class="ad-grade">' + grade + '</span></div>' +
        '<div class="ad-facts">' +
          '<p><b>' + res.total + '</b> records scored</p>' +
          '<p><b>' + res.dupedCount + '</b> in duplicate clusters (' + res.clusters.length + ' clusters, ' +
            pct(res.penalty) + ' pt penalty)</p>' +
          '<p><b>' + res.dead + '</b> unreachable: no valid email and no valid phone</p>' +
        '</div>' +
      '</div>' +
      '<div class="ad-dims">' + dimRows + '</div>' +
      '<table class="ad-table"><thead><tr><th>weakest records</th><th>score</th><th>worst dimension</th></tr></thead>' +
      '<tbody>' + worst + '</tbody></table>' +
      '<p class="ad-proof">Computed here, in this tab. Open your browser devtools network panel and confirm: ' +
      'nothing was uploaded. This page has no backend and this file makes no network calls.</p>';
    el("ad-results").hidden = false;
    el("ad-after").hidden = false;
  }

  function init() {
    var input = el("ad-input");
    if (!input) return;

    el("ad-sample").addEventListener("click", function () {
      input.value = sampleCSV();
      el("ad-error").hidden = true;
    });

    el("ad-run").addEventListener("click", function () {
      el("ad-error").hidden = true;
      try {
        var contacts = parseInput(input.value);
        var res = runEngine(contacts);
        if (!res) throw new Error("No usable records after parsing.");
        renderResults(res);
      } catch (err) {
        el("ad-error").textContent = err.message;
        el("ad-error").hidden = false;
        el("ad-results").hidden = true;
        el("ad-after").hidden = true;
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
