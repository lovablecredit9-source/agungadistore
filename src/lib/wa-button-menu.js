// lib/buttonMenu.js — helper tombol interaktif WhatsApp (Native Flow) untuk Bot Agung Adi Store.
// Konsep sama dengan quickReply()/singleSelect()/urlButton()/sendButtons() referensi,
// disesuaikan dengan @whiskeysockets/baileys ^6.7 (CommonJS, relayMessage + node "biz").
// Semua ID tombol = command existing, jadi otorisasi tetap dijalankan handler/server.
const { generateWAMessageFromContent, proto } = require("@whiskeysockets/baileys");

const cut = (s, n) => String(s == null ? "" : s).slice(0, n);

function quickReply(display_text, id) {
  return { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: cut(display_text, 20), id }) };
}
function urlButton(display_text, url) {
  return { name: "cta_url", buttonParamsJson: JSON.stringify({ display_text: cut(display_text, 20), url, merchant_url: url }) };
}
function buildRows(rows) {
  return (rows || []).slice(0, 10).map((r) => ({ id: r.id, title: cut(r.title, 24), description: cut(r.desc || r.description || "", 72) }));
}
function buildSections(sections) {
  return (sections || []).filter((s) => s && s.rows && s.rows.length).slice(0, 10).map((s) => ({ title: cut(s.title, 24), rows: buildRows(s.rows) }));
}
function singleSelect(title, sections) {
  return { name: "single_select", buttonParamsJson: JSON.stringify({ title: cut(title, 20), sections: buildSections(sections), has_multiple_buttons: true }) };
}

// ID pilihan dari semua format balasan (Native Flow, list lama, tombol lama, template).
function extractInteractiveId(content) {
  try {
    if (content?.buttonsResponseMessage?.selectedButtonId) return content.buttonsResponseMessage.selectedButtonId;
    if (content?.templateButtonReplyMessage?.selectedId) return content.templateButtonReplyMessage.selectedId;
    if (content?.listResponseMessage?.singleSelectReply?.selectedRowId) return content.listResponseMessage.singleSelectReply.selectedRowId;
    const nf = content?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
    if (nf) { const j = JSON.parse(nf); return j.id || j.selected_id || null; }
  } catch {}
  return null;
}

// Node tambahan yang dibutuhkan WhatsApp agar Native Flow ditampilkan (tanpa ini pesan tidak muncul).
function bizNode() {
  return [{ tag: "biz", attrs: {}, content: [{ tag: "interactive", attrs: { type: "native_flow", v: "1" }, content: [{ tag: "native_flow", attrs: { v: "9", name: "mixed" } }] }] }];
}
function buildInteractive({ title, body, footer, buttons }) {
  const IM = proto.Message.InteractiveMessage;
  return IM.create({
    body: IM.Body.create({ text: cut(body, 4000) }),
    footer: IM.Footer.create({ text: cut(footer, 60) }),
    header: IM.Header.create({ title: cut(title || "", 60), subtitle: "", hasMediaAttachment: false }),
    nativeFlowMessage: IM.NativeFlowMessage.create({ buttons, messageParamsJson: "" }),
  });
}
// Kirim pesan + tombol native. buttons = hasil quickReply()/singleSelect()/urlButton().
async function sendButtons(client, jid, { title, body, footer, buttons }, quoted) {
  if (typeof generateWAMessageFromContent !== "function" || !proto?.Message?.InteractiveMessage?.NativeFlowMessage) throw new Error("native flow unsupported");
  const message = { messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 }, interactiveMessage: buildInteractive({ title, body, footer, buttons }) };
  const m = generateWAMessageFromContent(jid, message, { userJid: client.user?.id, quoted });
  await client.relayMessage(jid, m.message, { messageId: m.key.id, additionalNodes: bizNode() });
  return m;
}

module.exports = { quickReply, singleSelect, urlButton, buildRows, buildSections, extractInteractiveId, sendButtons, bizNode };
