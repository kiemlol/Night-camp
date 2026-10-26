(() => {
  "use strict";
  const O = window.NC?.Online;
  if (!O?.enabled) return;
  const e = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const style = document.createElement("style");
  style.textContent = `#nc-controls{position:fixed;right:12px;bottom:75px;z-index:99990;font:14px system-ui;color:#f5edda}#nc-controls button,#nc-controls select,#nc-controls input{font:inherit;padding:8px;margin:3px;border-radius:7px;border:1px solid #71624b;background:#282c38;color:#fff}#nc-controls button{cursor:pointer}#nc-panel{background:#151a25f5;border:1px solid #988057;border-radius:14px;padding:16px;width:min(650px,calc(100vw - 58px));max-height:72vh;overflow:auto;box-shadow:0 10px 50px #0009}#nc-panel h2{font-size:19px;margin:5px 0 12px}#nc-panel h3{font-size:15px;color:#e9c078;margin:14px 0 5px}#nc-panel p{line-height:1.5;margin:8px 0}#nc-panel .nc-row{border-bottom:1px solid #ffffff18;padding:7px 0}#nc-panel nav{display:flex;flex-wrap:wrap}#nc-panel [aria-selected=true]{background:#715733}#nc-notice{max-width:600px;color:#ffcf83;font-size:12px;white-space:pre-wrap}`;
  document.head.append(style);
  const box = document.createElement("div");
  box.id = "nc-controls";
  box.innerHTML =
    '<button id="nc-toggle" type="button">Hành trang · Hệ thống</button><section id="nc-panel" hidden aria-label="Hệ thống nhân vật"><header><h2>Night Camp — Hành trình</h2></header><nav></nav><main></main><p id="nc-notice" role="status"></p></section>';
  document.body.append(box);
  const panel = box.querySelector("section"),
    main = box.querySelector("main"),
    nav = box.querySelector("nav"),
    notice = box.querySelector("#nc-notice");
  let tab = "journey",
    catalog = null,
    last = 0;
  const names = {
    journey: "Hành trình",
    gear: "Trang bị",
    craft: "Chế tạo",
    life: "Đời sống",
    social: "Bạn bè",
    market: "Chợ",
  };
  const button = (label, a) =>
    `<button type="button" data-command="${e(encodeURIComponent(JSON.stringify(a)))}">${e(label)}</button>`;
  const form = (name, fields, label) =>
    `<form data-form="${e(name)}">${fields}<button>${e(label)}</button></form>`;
  const select = (name, rows) =>
    `<select name="${e(name)}">${rows.map(([id, label]) => `<option value="${e(id)}">${e(label)}</option>`).join("")}</select>`;
  const material = (id) => catalog?.materials[id]?.name || id,
    item = (id) => catalog?.items[id]?.name || id;
  async function setup() {
    if (catalog) return;
    catalog = await (await fetch("/nc/catalog")).json();
  }
  function render() {
    const h = O.snap?.self;
    nav.innerHTML = Object.entries(names)
      .map(
        ([id, label]) =>
          `<button data-tab="${id}" aria-selected="${tab === id}">${label}</button>`,
      )
      .join("");
    if (!h) {
      main.innerHTML =
        "<p>Đăng nhập, tạo hoặc chọn nhân vật bằng màn hình chính rồi vào game. Các hệ thống bên dưới sẽ mở khi kết nối thành công.</p>";
      return;
    }
    let html = `<p>${e(h.name)} · Lv ${h.lv} · ${e(h.job)} ${h.jobLv} · ${h.coins} xu<br>HP ${h.hp}/${h.hpMax} · SP ${h.sp}/${h.spMax} · Kênh ${e(h.channelId)}</p>`;
    if (tab === "journey") {
      const q = h.quests.main,
        o = q.objectives?.[0];
      html += `<h3>Nhiệm vụ: ${e(q.id)}</h3><p>${e(o?.kind || "Hoàn tất")} ${o ? `${o.have}/${o.need}` : ""} · ${e(q.state)}</p>`;
      if (q.state === "ready")
        html += button("Hoàn thành nhiệm vụ", {
          action: "quest",
          op: "handin",
          id: q.id,
        });
      if (q.pendingChoice)
        html +=
          "<p>Chọn hướng đi cho hành trình:</p>" +
          button("Giúp đỡ trại (+5 danh vọng)", {
            action: "quest",
            op: "choose",
            id: q.id,
            choice: "a",
          }) +
          button("Theo con đường riêng (+2)", {
            action: "quest",
            op: "choose",
            id: q.id,
            choice: "b",
          });
      html +=
        "<h3>Tiến trình</h3>" +
        button("Nhận điểm danh hôm nay", { $rpc: "nc_checkin_claim" }) +
        button("Nhận thưởng ngày (5 quái)", { action: "daily" }) +
        button("Nghỉ tại trại", { action: "rest" }) +
        button(h.auto ? "Dừng tự đánh" : "Tự đánh quái", {
          action: "auto",
          kind: h.auto ? "stop" : "start",
        }) +
        button("Hồi sinh về trại", { action: "revive" });
      html +=
        "<h3>Phân bổ điểm</h3><p>Điểm chỉ số: " +
        h.statPts +
        " · Điểm kỹ năng: " +
        h.skillPts +
        "</p>";
      for (const k of Object.keys(h.base || {}))
        html += button(`${k.toUpperCase()} ${h.base[k]} +`, {
          action: "stat",
          stat: k,
          count: 1,
        });
      const jobs = Object.entries(catalog?.jobs || {}).filter(
        ([id, j]) =>
          j.tier === (catalog.jobs[h.job]?.tier || 0) + 1 &&
          (!j.from || j.from === h.job),
      );
      html += form(
        "job",
        select(
          "job",
          jobs.map(([id, j]) => [id, j.name]),
        ),
        "Đổi nghề (đạt Job tối đa)",
      );
      const skills = new Set();
      let job = h.job;
      while (job) {
        for (const id of catalog?.jobs[job]?.skills || []) skills.add(id);
        job = catalog?.jobs[job]?.from;
      }
      html += form(
        "skill",
        select(
          "skillId",
          [...skills].map((id) => [
            id,
            (catalog.skills[id]?.name || id) + " " + (h.skills[id] || 0),
          ]),
        ),
        "Học kỹ năng",
      );
      html +=
        "<h3>Di chuyển và phụ bản</h3>" +
        form(
          "travel",
          select(
            "mapId",
            Object.entries(catalog?.maps || {}).map(([id, m]) => [
              id,
              m.name || id,
            ]),
          ),
          "Dịch chuyển (10 xu, xuất phát tại trại)",
        );
      if (!h.dungeon)
        html += button("Vào phụ bản gốc cây (Lv5)", {
          action: "root",
          kind: "start",
        });
      else
        html +=
          `<p>Phụ bản: ${h.dungeon.cleared ? "Đã hạ boss" : "Đang chiến đấu"}</p>` +
          button("Nhận thưởng và rời phụ bản", {
            action: "root",
            kind: "claim",
          }) +
          button("Rời phụ bản", { action: "root", kind: "leave" });
    }
    if (tab === "gear") {
      html += "<h3>Túi đồ</h3>";
      for (const c of h.bag || []) {
        const worn = Object.values(h.wu || {}).includes(c.u),
          slot = catalog?.items[c.id]?.slot;
        html +=
          `<div class="nc-row">${e(item(c.id))} +${c.ref || 0} · bậc ${c.g || 0} ${worn ? "· Đang mặc" : ""}<br>` +
          button("Mặc", { action: "equip", itemId: c.id, slot, copyId: c.u }) +
          button("Cất kho", { action: "store", kind: "put", copyId: c.u }) +
          button("Bán 25 xu", { action: "sellgear", copyIds: [c.u] }) +
          button("Cường hóa", {
            action: "forge",
            kind: "refine",
            copyId: c.u,
          }) +
          "</div>";
      }
      html +=
        button("Mở thêm 10 ô (500 xu)", { action: "bagexpand" }) +
        "<h3>Kho</h3>";
      for (const c of h.store || [])
        html +=
          `<div class="nc-row">${e(item(c.id))}` +
          button("Lấy ra", { action: "store", kind: "take", copyId: c.u }) +
          "</div>";
      html += "<h3>Nguyên liệu</h3>";
      for (const [id, n] of Object.entries(h.mats || {}))
        if (n)
          html +=
            `<div class="nc-row">${e(material(id))} × ${n}` +
            button("Bán 1", { action: "sell", itemId: id, count: 1 }) +
            "</div>";
    }
    if (tab === "craft") {
      html +=
        "<h3>Công thức của server</h3><p>Vũ khí thường: 150 xu + 3 gel lá + 2 nanh lợn. Đồ hiếm cần Lv10, epic Lv25, legend Lv50 và giá tăng theo cấp; epic thêm 2 lõi golem, legend thêm 3 bào tử vua. Cường hóa: 100 × cấp kế tiếp; cấp +4 trở đi có thể thất bại. Nâng bậc: 500 xu + 1 lõi golem.</p>";
      html += form(
        "craft",
        select(
          "itemId",
          Object.entries(catalog?.items || {})
            .filter(([, v]) => v.slot === "weapon")
            .map(([id, v]) => [id, v.name]),
        ),
        "Chế tạo vũ khí",
      );
      html +=
        "<h3>Dược phẩm</h3>" +
        button("Mua bình HP (15 xu)", {
          action: "buy",
          kind: "red",
          count: 1,
        }) +
        button("Mua bình SP (15 xu)", {
          action: "buy",
          kind: "blue",
          count: 1,
        }) +
        button("Dùng HP", { action: "potion", kind: "hp" }) +
        button("Dùng SP", { action: "potion", kind: "sp" }) +
        button("Nấu bình HP (5 xu + gel lá)", {
          action: "brew",
          itemId: "red",
          count: 1,
        });
      html +=
        "<h3>Bữa ăn</h3><p>Súp: 5 xu + 1 gel lá + 1 nanh lợn. Hồi 50 HP và 10 SP.</p>" +
        button("Nấu súp", { action: "cook", itemId: "camp_soup", count: 1 }) +
        button(`Ăn súp (${h.food?.camp_soup || 0})`, {
          action: "eat",
          itemId: "camp_soup",
        });
    }
    if (tab === "life") {
      html +=
        "<h3>Thu thập</h3><p>Mỗi lượt mất 3 giây, thưởng một nguyên liệu.</p>";
      html += form(
        "gather",
        select(
          "itemId",
          (catalog?.resources?.[h.mapId] || []).map((id) => [id, material(id)]),
        ),
        "Bắt đầu thu thập",
      );
      if (h.panelGathering)
        html +=
          `<p>${e(h.panelGathering.phase)} · ${Math.max(0, Math.ceil((h.panelGathering.readyAt - Date.now()) / 1000))} giây</p>` +
          button("Nhận nguyên liệu", { action: "gather", kind: "claim" }) +
          button("Dừng", { action: "gather", kind: "stop" });
      html +=
        "<h3>Vườn thảo dược</h3><p>Trồng: 10 xu. Thu hoạch sau 60 giây được 3 gel lá.</p>";
      for (const [i, p] of (h.farm?.plots || Array(6).fill(null)).entries())
        html +=
          `<div>Ô ${i + 1}: ${p ? Math.max(0, Math.ceil((p.readyAt - Date.now()) / 1000)) + " giây" : "Trống"}` +
          button(p ? "Thu hoạch" : "Trồng", {
            action: "life",
            kind: p ? "harvest" : "plant",
            count: i,
          }) +
          "</div>";
      html += button("Thêm ô vườn (250 xu)", {
        action: "life",
        kind: "expand",
        count: 0,
      });
    }
    if (tab === "social") {
      html +=
        `<p>Tổ đội: ${e(h.partyId || "Chưa có")}<br>Bang: ${e(h.guildId || "Chưa có")}</p>` +
        button("Lập tổ đội", { action: "party", kind: "create" }) +
        button("Rời đội", { action: "party", kind: "leave" }) +
        form(
          "guild",
          '<input name="name" placeholder="Tên bang" required maxlength="24">',
          "Lập bang (1.000 xu)",
        );
      for (const p of O.snap.players || [])
        html +=
          `<div class="nc-row">${e(p.name)} · Lv ${p.lv}<br>` +
          button("Mời tổ đội", {
            action: "party",
            kind: "invite",
            targetId: p.id,
          }) +
          button("Nhận lời mời đội", {
            action: "party",
            kind: "accept",
            targetId: p.id,
          }) +
          button("Kết bạn", { action: "friend", kind: "add", targetId: p.id }) +
          button("Đồng ý kết bạn", {
            action: "friend",
            kind: "accept",
            targetId: p.id,
          }) +
          button("Mời đấu", { action: "pvp", kind: "invite", targetId: p.id }) +
          button("Nhận đấu", {
            action: "pvp",
            kind: "accept",
            targetId: p.id,
          }) +
          "</div>";
      html += form(
        "chat",
        '<input name="text" placeholder="Lời nhắn trong map" maxlength="200" required>',
        "Gửi",
      );
    }
    if (tab === "market") {
      html +=
        "<h3>Chợ người chơi</h3><p>Người bán nhận 95% giá bán. Đồ đã mặc cần tháo trước khi rao.</p>" +
        form(
          "list",
          select(
            "copyId",
            (h.bag || [])
              .filter((c) => !Object.values(h.wu || {}).includes(c.u))
              .map((c) => [c.u, item(c.id)]),
          ) +
            '<input name="price" type="number" min="1" max="1000000" value="100" required>',
          "Rao bán",
        ) +
        button("Tải danh sách chợ", { $market: true }) +
        '<div id="nc-listings"></div>';
    }
    main.innerHTML = html;
  }
  async function act(a) {
    if (a.$rpc) {
      const r = await O.rpc(a.$rpc, {});
      notice.textContent = JSON.stringify(r);
      return;
    }
    if (a.$market) {
      const r = await O.rpc("nc_broker", {});
      box.querySelector("#nc-listings").innerHTML =
        (r.rows || [])
          .map(
            (row) =>
              `<div class="nc-row">${e(item(row.copy.id))} · ${row.price} xu` +
              button(row.seller === O.snap.self.id ? "Thu hồi" : "Mua", {
                action: "broker",
                kind: row.seller === O.snap.self.id ? "unlist" : "buy",
                id: row.id,
              }) +
              "</div>",
          )
          .join("") || "<p>Chưa có món rao bán.</p>";
      return;
    }
    if (a.action === "gather") a.source = "panel";
    if (!O.action(a)) throw new Error("Chưa kết nối game");
    notice.textContent = "Đã gửi yêu cầu.";
  }
  box.addEventListener("click", async (event) => {
    try {
      const b = event.target.closest("button");
      if (!b) return;
      if (b.id === "nc-toggle") {
        panel.hidden = !panel.hidden;
        await setup();
        render();
      } else if (b.dataset.tab) {
        tab = b.dataset.tab;
        render();
      } else if (b.dataset.command)
        await act(JSON.parse(decodeURIComponent(b.dataset.command)));
    } catch (error) {
      notice.textContent = error.message;
    }
  });
  box.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const f = event.target,
        v = Object.fromEntries(new FormData(f));
      let a = { action: f.dataset.form, ...v };
      if (a.action === "craft")
        a = { action: "forge", kind: "craft", itemId: v.itemId };
      if (a.action === "gather") a.kind = "start";
      if (a.action === "guild") a.kind = "found";
      if (a.action === "chat") a = { action: "send", ch: "map", text: v.text };
      if (a.action === "list")
        a = {
          action: "broker",
          kind: "list",
          copyId: Number(v.copyId),
          price: Number(v.price),
        };
      await act(a);
    } catch (error) {
      notice.textContent = error.message;
    }
  });
  for (const kind of ["keydown", "keyup", "pointerdown", "pointerup"])
    box.addEventListener(kind, (event) => event.stopPropagation());
  O.on("event", (ev) => {
    if (ev.type === "error") notice.textContent = ev.message;
    else if (["chat", "partyInvite", "pvpInvite", "social"].includes(ev.type))
      notice.textContent = [ev.name, ev.text || ev.type]
        .filter(Boolean)
        .join(": ");
  });
  O.on("snapshot", () => {
    if (
      !panel.hidden &&
      Date.now() - last > 1000 &&
      !box.querySelector("input:focus,select:focus,textarea:focus") &&
      tab !== "market"
    ) {
      last = Date.now();
      render();
    }
  });
})();
